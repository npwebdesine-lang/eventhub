import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans" dir="rtl">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm border border-slate-100">
        <button onClick={() => navigate(-1)} className="mb-8 p-3 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
          <ChevronLeft size={24} />
        </button>
        
        <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-2">תנאי שימוש</h1>
        <p className="text-slate-500 font-medium mb-8">תאריך עדכון אחרון: 7 באפריל 2026</p>

        <div className="prose prose-slate max-w-none text-slate-700 space-y-6">
          <p>
            ברוכים הבאים ל-<strong>Eventick</strong>. השימוש באפליקציה, באתר ובשירותים המוצעים בהם כפוף לתנאים המפורטים להלן. בעצם הכניסה לאירוע או השימוש במערכת, הנך מאשר כי קראת, הבנת והסכמת לתנאים אלו.
          </p>

          <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">1. תוכן גולשים (User Generated Content) ומודרציה</h3>
          <p>
            האפליקציה מאפשרת למשתמשים להעלות תמונות, לכתוב הודעות ולשתף מידע (להלן: "תוכן גולשים"). אנו נוקטים במדיניות של <strong>אפס סובלנות</strong> כלפי תוכן פוגעני.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>חל איסור מוחלט להעלות תוכן מיני בוטה, אלים, גזעני, מאיים, מפר זכויות יוצרים, או כל תוכן המנוגד לחוק.</li>
            <li>למשתמשים יש אפשרות לדווח על תוכן פוגעני או לחסום משתמשים אחרים בתוך האפליקציה.</li>
            <li>אנו (ומנהלי האירוע) שומרים לעצמנו את הזכות למחוק כל תוכן או לחסום/להרחיק כל משתמש מהמערכת ללא הודעה מוקדמת, לפי שיקול דעתנו הבלעדי.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">2. הגבלת אחריות</h3>
          <p>
            השירות ניתן כפי שהוא ("AS-IS"). החברה אינה מתחייבת שהשירות יהיה חסין מפני תקלות, שגיאות, או נפילות שרתים.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>לוח טרמפים ודייטליין:</strong> המערכת מספקת פלטפורמה טכנית בלבד ליצירת קשר בין אורחים. החברה אינה אחראית לזהות המשתמשים, לטיב הנסיעה, לבטיחותה, או לכל נזק, פציעה או אובדן שייגרמו כתוצאה ממפגש בין משתמשים שהכירו דרך הפלטפורמה.</li>
            <li>החברה לא תישא באחריות לכל אובדן של נתונים או תמונות שהועלו לאלבום הדיגיטלי. באחריות המשתמשים ומפיקי האירוע לגבות את התוכן שלהם.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">3. זכויות יוצרים וקניין רוחני</h3>
          <p>
            הבעלות על כל קוד, עיצוב, מותג (Eventick) וטכנולוגיה המרכיבים את השירות שייכת לחברה. 
            <br/>על ידי העלאת תמונות לאפליקציה, אתה שומר על הבעלות עליהן, אך מעניק לחברה ולמפיקי האירוע רישיון חינם, בלתי חוזר וכלל-עולמי להציגן בתוך האלבום הדיגיטלי של אותו אירוע ולשתפן עם שאר האורחים.
          </p>

          <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">4. מפיקי אירועים (תנאים מסחריים)</h3>
          <p>
            מפיקים ורוכשי חבילות מנויים לאפליקציה דרך מערכת ה-Admin כפופים להסכם הרכישה שנחתם מול החברה. שימוש במערכת מהווה הסכמה כי באחריות המפיק לפקח על התוכן באירוע שלו ולהוריד תכנים שדווחו כפוגעניים על ידי האורחים.
          </p>

          <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">5. סמכות שיפוט</h3>
          <p>
            על תנאי שימוש אלו יחולו דיני מדינת ישראל. כל סכסוך משפטי הנובע משימוש באפליקציה יתברר בבלעדיות בבתי המשפט המוסמכים במחוז תל אביב-יפו.
          </p>

          <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">6. יצירת קשר</h3>
          <p>
            לדיווח על הפרת תקנון או פניות כלליות, ניתן לפנות אלינו ב: <a href="mailto:support@eventick.app" className="text-indigo-600 font-bold">support@eventick.app</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Terms;