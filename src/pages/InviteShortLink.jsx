// קישור ההזמנה הכללי הקצר: /i/<code> → /invite/<eventId>.
// הקוד הוא ה-UUID של האירוע ב-base64url (ראו src/lib/rsvpLink.js), כך
// שהפענוח מקומי ומיידי — בלי פנייה לשרת.
import { Navigate, useLocation, useParams } from "react-router-dom";
import { decodeGuestCode } from "../lib/rsvpLink";

const InviteShortLink = () => {
  const { code } = useParams();
  const { search, hash } = useLocation();
  const eventId = decodeGuestCode(code);

  // קוד שלא מתפענח מוביל לסורק, כמו כל קישור שבור אחר.
  if (!eventId) return <Navigate to="/" replace />;
  return <Navigate to={`/invite/${eventId}${search}${hash}`} replace />;
};

export default InviteShortLink;
