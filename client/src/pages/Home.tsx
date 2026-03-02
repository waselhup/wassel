import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getLoginUrl } from "@/const";
import { ArrowRight, CheckCircle, Zap, Shield, Users, BarChart3 } from "lucide-react";

export default function Home() {
  const { user } = useAuth();

  if (user) {
    // Redirect authenticated users to dashboard
    window.location.href = "/dashboard";
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-600">وصل</h1>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-gray-700 hover:text-blue-600 font-medium">
              المميزات
            </a>
            <a href="#pricing" className="text-gray-700 hover:text-blue-600 font-medium">
              الأسعار
            </a>
            <Button
              onClick={() => window.location.href = getLoginUrl()}
              variant="outline"
              className="text-gray-700"
            >
              تسجيل الدخول
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="mb-8">
          <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
            ✨ منصة ذكية لإدارة LinkedIn
          </span>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          وصل بثقة إلى عملائك
        </h1>

        <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
          منصة احترافية تساعدك على إدارة حملات LinkedIn بذكاء. من اكتشاف العملاء المحتملين إلى المتابعة الفعالة، كل شيء مؤتمت وآمن.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Button
            onClick={() => window.location.href = getLoginUrl()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 text-lg flex items-center gap-2 justify-center"
          >
            ابدأ مجاناً
            <ArrowRight className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            className="border-2 border-gray-300 text-gray-700 font-semibold py-3 px-8 text-lg"
          >
            شاهد العرض التوضيحي
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-8 justify-center text-sm text-gray-600 mb-20">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span>لا يتطلب بطاقة ائتمان</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span>تجربة مجانية 14 يوم</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span>دعم 24/7</span>
          </div>
        </div>

        {/* Hero Image Placeholder */}
        <div className="bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl p-12 h-96 flex items-center justify-center border border-blue-200">
          <div className="text-center">
            <BarChart3 className="w-24 h-24 text-blue-400 mx-auto mb-4 opacity-50" />
            <p className="text-gray-600">لوحة تحكم احترافية وسهلة الاستخدام</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">المميزات الرئيسية</h2>
          <p className="text-xl text-gray-600">كل ما تحتاجه لإدارة حملات LinkedIn بفعالية</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white rounded-xl p-8 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">أتمتة ذكية</h3>
            <p className="text-gray-600">
              أتمت حملاتك بذكاء مع الحفاظ على اللمسة الشخصية. كل رسالة مخصصة لكل عميل محتمل.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-xl p-8 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">آمان وموثوقية</h3>
            <p className="text-gray-600">
              أنت تتحكم بكل خطوة. كل إجراء يتم مراجعته من قبلك قبل الإرسال إلى LinkedIn.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-xl p-8 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">إدارة فريق</h3>
            <p className="text-gray-600">
              تعاون مع فريقك بسهولة. شارك الحملات والعملاء المحتملين مع أعضاء فريقك.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">أسعار بسيطة وشفافة</h2>
          <p className="text-xl text-gray-600">اختر الخطة المناسبة لك</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Free Plan */}
          <div className="bg-white rounded-xl p-8 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">مجاني</h3>
            <p className="text-gray-600 mb-6">للبدء</p>
            <div className="text-4xl font-bold text-gray-900 mb-6">
              0 ر.س
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-gray-700">حملة واحدة</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-gray-700">25 عميل محتمل</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-gray-700">دعم البريد الإلكتروني</span>
              </li>
            </ul>
            <Button
              onClick={() => window.location.href = getLoginUrl()}
              variant="outline"
              className="w-full border-2 border-gray-300 text-gray-700 font-semibold py-2.5"
            >
              ابدأ الآن
            </Button>
          </div>

          {/* Pro Plan */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 border-2 border-blue-600 relative">
            <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 rounded-bl-lg rounded-tr-xl text-sm font-semibold">
              الأكثر شيوعاً
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2 mt-4">احترافي</h3>
            <p className="text-gray-600 mb-6">للمحترفين</p>
            <div className="text-4xl font-bold text-gray-900 mb-6">
              99 ر.س
              <span className="text-lg text-gray-600">/شهر</span>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-gray-700">حملات غير محدودة</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-gray-700">5000 عميل محتمل</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-gray-700">دعم الأولوية</span>
              </li>
            </ul>
            <Button
              onClick={() => window.location.href = getLoginUrl()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5"
            >
              ابدأ الآن
            </Button>
          </div>

          {/* Enterprise Plan */}
          <div className="bg-white rounded-xl p-8 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">مؤسسي</h3>
            <p className="text-gray-600 mb-6">للفرق الكبيرة</p>
            <div className="text-4xl font-bold text-gray-900 mb-6">
              تواصل
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-gray-700">كل شيء في الاحترافي</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-gray-700">دعم مخصص</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-gray-700">تكامل مخصص</span>
              </li>
            </ul>
            <Button
              variant="outline"
              className="w-full border-2 border-gray-300 text-gray-700 font-semibold py-2.5"
            >
              تواصل معنا
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-16 text-center text-white">
          <h2 className="text-4xl font-bold mb-6">جاهز للبدء؟</h2>
          <p className="text-xl mb-8 opacity-90">
            انضم إلى مئات المحترفين الذين يستخدمون وصل لإدارة حملات LinkedIn بفعالية
          </p>
          <Button
            onClick={() => window.location.href = getLoginUrl()}
            className="bg-white text-blue-600 hover:bg-gray-100 font-semibold py-3 px-8 text-lg"
          >
            ابدأ مجاناً الآن
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">وصل</h3>
              <p className="text-gray-600">منصة ذكية لإدارة حملات LinkedIn</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">المنتج</h4>
              <ul className="space-y-2 text-gray-600">
                <li><a href="#" className="hover:text-blue-600">المميزات</a></li>
                <li><a href="#" className="hover:text-blue-600">الأسعار</a></li>
                <li><a href="#" className="hover:text-blue-600">الأمان</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">الشركة</h4>
              <ul className="space-y-2 text-gray-600">
                <li><a href="#" className="hover:text-blue-600">عن</a></li>
                <li><a href="#" className="hover:text-blue-600">المدونة</a></li>
                <li><a href="#" className="hover:text-blue-600">الوظائف</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">قانوني</h4>
              <ul className="space-y-2 text-gray-600">
                <li><a href="#" className="hover:text-blue-600">الخصوصية</a></li>
                <li><a href="#" className="hover:text-blue-600">الشروط</a></li>
                <li><a href="#" className="hover:text-blue-600">الاتصال</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 text-center text-gray-600">
            <p>&copy; 2026 وصل. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
