import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { decodeGuestCode, statusFromLinkParam } from "../lib/rsvpLink";
import { isValidUUIDv4 } from "../utils/deviceId";
import { CLAY_INSET, CLAY_RAISED } from "../lib/clay";

// נקודת הכניסה של קישורי הקסם מוואטסאפ. העמוד הזה לא מציג טופס משלו: הוא
// מזהה לאיזה אירוע האורח שייך ומעביר אותו להזמנה המאוחדת (/invite/:eventId),
// שם נמצא טופס אישור ההגעה היחיד. כך יש מקום אחד לתחזק במקום שניים.
//
// שתי צורות כתובת מגיעות לכאן:
//   /r/<code>?s=1|0                              — הקישור הקצר הנוכחי
//   /rsvp-action?id=<uuid>&status=confirmed|...   — קישורים ישנים שכבר נשלחו
//
// הסטטוס לא מוחל כאן אלא מועבר הלאה; Invite.jsx מחיל אותו מיד עם הטעינה.

const LEGACY_STATUSES = ["confirmed", "canceled"];

const ERROR_COPY = {
  invalid_link: "הקישור אינו תקין — לא מצאנו את ההזמנה הזו.",
  network: "תקלה בחיבור, נסו שוב.",
};

export default function RsvpLink() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const guestId = code ? decodeGuestCode(code) : searchParams.get("id");
  const legacyStatus = searchParams.get("status");
  const status = code
    ? statusFromLinkParam(searchParams.get("s"))
    : LEGACY_STATUSES.includes(legacyStatus)
      ? legacyStatus
      : null;
  const linkIsValid = typeof guestId === "string" && isValidUUIDv4(guestId);

  const [errorCode, setErrorCode] = useState(
    linkIsValid ? null : "invalid_link",
  );

  useEffect(() => {
    if (!linkIsValid) return;
    let isMounted = true;

    (async () => {
      // anon לא יכול לקרוא את event_guests ישירות; ה-RPC הזה הוא נתיב
      // הקריאה היחיד, והוא read-only — הנחיתה כאן לא משנה שום תשובה.
      const { data, error } = await supabase.rpc("rsvp_guest_group", {
        p_guest_id: guestId,
      });
      if (!isMounted) return;
      if (error) {
        console.error(error);
        setErrorCode("network");
        return;
      }
      const rows = Array.isArray(data) ? data : [];
      const row = rows.find((entry) => entry.is_self) || rows[0];
      if (!row?.event_id) {
        setErrorCode("invalid_link");
        return;
      }
      const query = new URLSearchParams({ guest_id: guestId });
      if (status) query.set("status", status);
      // replace: כפתור "חזרה" לא יחזיר לעמוד הביניים ויפעיל את ההפניה שוב.
      navigate(`/invite/${row.event_id}?${query}`, { replace: true });
    })();

    return () => {
      isMounted = false;
    };
  }, [linkIsValid, guestId, status, navigate]);

  if (!errorCode) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center bg-clay-gradient"
      >
        <Loader2 className="animate-spin text-clay-muted" size={44} />
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-clay-gradient"
    >
      <div
        className={`rounded-clay-lg ${CLAY_RAISED} w-full max-w-md p-10 text-center`}
      >
        <div
          className={`${CLAY_INSET} mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full`}
        >
          <X size={34} className="text-clay-muted" />
        </div>
        <h1 className="mb-3 text-2xl font-black text-slate-700">אופס</h1>
        <p className="text-clay-muted">{ERROR_COPY[errorCode]}</p>
      </div>
    </div>
  );
}
