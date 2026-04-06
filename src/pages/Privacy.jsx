import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans" dir="rtl">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm border border-slate-100">
        <button onClick={() => navigate(-1)} className="mb-8 p-3 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
          <ChevronLeft size={24} />
        </button>
        
        <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-2">מדיניות פרטיות</h1>
        <p className="text-slate-500 font-medium mb-8">תאריך עדכון אחרון: [תאריך של היום]</p>

        <div className="prose prose-slate max-w-none text-slate-700 space-y-6">
          <p>
            אנו ב-<strong>Eventick</strong> (להלן: "החברה", "אנו" או "המערכת") מכבדים את פרטיותך. מסמך זה מפרט איזה מידע אישי אנו אוספים, כיצד אנו משתמשים בו, וכיצד אנו שומרים עליו מאובטח בעת שימושך באפליקציה או באתר (להלן: "השירות").
          </p>

          <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">1. איזה מידע אנו אוספים?</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>מידע שנמסר על ידי אורחים:</strong> בעת הכניסה לאירוע, אנו אוספים את שמך המלא. אם תבחר להשתמש בפיצ'ר הטרמפים או אישורי ההגעה, נידרש לאסוף גם את מספר הטלפון שלך.</li>
            <li><strong>תוכן משתמשים (UGC):</strong> תמונות וסרטונים שאתה מעלה לאלבום האירוע, הודעות טקסט הנשלחות במודול ה"דייטליין" (Dating), והטקסט שאתה כותב בפרופיל שלך.</li>
            <li><strong>מידע שנמסר על ידי מפיקים/מנהלי אירוע:</strong> פרטי התקשרות עסקיים, כתובת אימייל ופרטי אמצעי תשלום (אשר מעובדים על ידי ספקי סליקה חיצוניים מאובטחים ואינם נשמרים בשרתינו).</li>
            <li><strong>נתונים טכניים (Log Data):</strong> מזהי מכשיר, סוג דפדפן, כתובת IP (לצורכי אבטחה), ונתוני שימוש בסיסיים המסייעים לנו לשפר את המערכת.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">2. כיצד אנו משתמשים במידע?</h3>
          <p>המידע נאסף אך ורק למטרות הבאות:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>תפעול שוטף של פיצ'רי האירוע (הצגת שמך לצד תמונות שהעלית, חיבור בין נוסעים לנהגים בלוח הטרמפים).</li>
            <li>מניעת הונאות, אכיפת תנאי השימוש, וטיפול בדיווחים על תוכן פוגעני.</li>
            <li>יצירת קשר עם מפיקי האירוע למטרות תמיכה טכנית ושירות לקוחות.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">3. שיתוף מידע עם צדדים שלישיים</h3>
          <p>
            איננו מוכרים את המידע האישי שלך. המידע עשוי להיות משותף רק עם שירותי תשתית (כגון שירותי ענן ומסדי נתונים של Supabase) המאחסנים את המידע תחת תקני אבטחה מחמירים. בנוסף, מידע שתבחר להעלות (תמונות, הודעות בלוח טרמפים) יהיה גלוי לאורחים אחרים באותו אירוע.
          </p>

          <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">4. שמירת נתונים ומחיקתם (זכות להישכח)</h3>
          <p>
            אנו שומרים את הנתונים שלך רק כל עוד הם נדרשים לצורך אספקת השירות. אורח או מפיק זכאי לבקש את מחיקת המידע האישי שלו מהמערכת בכל עת. למחיקת נתונים, ניתן להשתמש בכפתור "פרישה מהמשחק/הסרת חשבון" באפליקציה או לפנות אלינו ישירות. 
            <strong>לתשומת לב מפיקי האירוע:</strong> נתוני האירועים עשויים להימחק משרתינו [X] ימים לאחר תום האירוע, אלא אם הוסכם אחרת.
          </p>

          <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">5. קטינים</h3>
          <p>
            חלק מפיצ'רי האפליקציה (כגון מודול ה"דייטליין") מיועדים למשתמשים מעל גיל 18. איננו אוספים ביודעין מידע אישי מילדים מתחת לגיל 13 ללא הסכמת הורה.
          </p>

          <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">6. יצירת קשר</h3>
          <p>
            לכל שאלה הנוגעת לפרטיות או לבקשת מחיקת נתונים, ניתן לפנות אלינו בכתובת האימייל: <a href="mailto:[כתובת האימייל שלך]" className="text-indigo-600 font-bold">[כתובת האימייל שלך]</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;