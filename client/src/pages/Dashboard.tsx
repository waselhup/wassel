import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Zap, Users, Target, Clock, ArrowRight, CheckCircle2, Lightbulb } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [currentStep, setCurrentStep] = useState<'welcome' | 'create-campaign' | 'add-leads' | 'review-queue' | 'done'>('welcome');

  // Fetch user profile
  const { data: profile, isLoading: profileLoading } = trpc.auth.me.useQuery();

  // Fetch user's team
  const { data: team, isLoading: teamLoading } = trpc.auth.getTeam.useQuery();

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  if (profileLoading || teamLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل لوحة التحكم...</p>
        </div>
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'مستخدم';

  // Onboarding steps
  const steps = [
    { id: 'welcome', label: 'مرحباً', icon: '👋' },
    { id: 'create-campaign', label: 'إنشاء حملة', icon: '🎯' },
    { id: 'add-leads', label: 'إضافة عملاء', icon: '👥' },
    { id: 'review-queue', label: 'مراجعة الإجراءات', icon: '✓' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-600">وصل</h1>
            <p className="text-sm text-gray-600">لوحة التحكم الرئيسية</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{profile?.full_name || 'مستخدم'}</p>
              <p className="text-xs text-gray-500">{profile?.email}</p>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            مرحباً بك يا {firstName}! 👋
          </h2>
          <p className="text-lg text-gray-600">
            منصة ذكية لإدارة حملات LinkedIn بكفاءة واحترافية
          </p>
        </div>

        {/* Onboarding Progress */}
        {currentStep !== 'done' && (
          <div className="mb-12">
            <Card className="p-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              {/* Progress Steps */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  {steps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                          step.id === currentStep
                            ? 'bg-blue-600 text-white scale-110'
                            : steps.findIndex(s => s.id === step.id) < steps.findIndex(s => s.id === currentStep)
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {steps.findIndex(s => s.id === step.id) < steps.findIndex(s => s.id === currentStep) ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          step.icon
                        )}
                      </div>
                      {index < steps.length - 1 && (
                        <div
                          className={`flex-1 h-1 mx-2 transition-all ${
                            steps.findIndex(s => s.id === step.id) < steps.findIndex(s => s.id === currentStep)
                              ? 'bg-green-600'
                              : 'bg-gray-300'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-center text-sm text-gray-600">
                  {currentStep === 'welcome' && 'دعنا نبدأ رحلتك مع وصل'}
                  {currentStep === 'create-campaign' && 'الخطوة 1: أنشئ حملتك الأولى'}
                  {currentStep === 'add-leads' && 'الخطوة 2: أضف عملاءك المحتملين'}
                  {currentStep === 'review-queue' && 'الخطوة 3: راجع الإجراءات المعلقة'}
                </div>
              </div>

              {/* Step Content */}
              <div className="bg-white rounded-lg p-6 mb-6">
                {currentStep === 'welcome' && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">ابدأ رحلتك مع وصل</h3>
                    <p className="text-gray-700 mb-4 leading-relaxed">
                      سنساعدك على فهم كيفية عمل النظام خطوة بخطوة. في غضون دقائق، ستكون جاهزاً لإدارة حملات LinkedIn الخاصة بك.
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600 mb-6">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span>إنشاء حملة في ثانية واحدة</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span>إضافة عملاء محتملين بسهولة</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span>التحكم الكامل قبل الإرسال</span>
                      </li>
                    </ul>
                  </div>
                )}

                {currentStep === 'create-campaign' && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">إنشاء حملتك الأولى</h3>
                    <p className="text-gray-700 mb-4">
                      الحملة هي مجموعة من الإجراءات المنظمة. يمكنك إنشاء حملة لكل هدف أو فئة عملاء.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-blue-900">
                        <strong>💡 نصيحة:</strong> ابدأ بحملة واحدة بسيطة، مثل "توظيف مهندسين" أو "عملاء جدد".
                      </p>
                    </div>
                  </div>
                )}

                {currentStep === 'add-leads' && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">إضافة عملاء محتملين</h3>
                    <p className="text-gray-700 mb-4">
                      أضف الأشخاص الذين تريد التواصل معهم. يمكنك إضافة بريدهم الإلكتروني أو رابط ملفهم الشخصي على LinkedIn.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-blue-900">
                        <strong>💡 نصيحة:</strong> استخدم الإضافة على LinkedIn مباشرة من خلال الإضافة الموجودة في المتصفح.
                      </p>
                    </div>
                  </div>
                )}

                {currentStep === 'review-queue' && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">مراجعة الإجراءات المعلقة</h3>
                    <p className="text-gray-700 mb-4">
                      كل إجراء يتطلب موافقتك قبل الإرسال. هذا يعطيك التحكم الكامل ويضمن جودة الرسائل.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-blue-900">
                        <strong>💡 نصيحة:</strong> راجع الرسالة والعميل قبل الموافقة. يمكنك رفضها إذا أردت.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                {currentStep !== 'welcome' && (
                  <Button
                    onClick={() => {
                      const stepOrder = ['welcome', 'create-campaign', 'add-leads', 'review-queue'];
                      const currentIndex = stepOrder.indexOf(currentStep);
                      if (currentIndex > 0) {
                        setCurrentStep(stepOrder[currentIndex - 1] as any);
                      }
                    }}
                    variant="outline"
                    className="text-gray-700"
                  >
                    السابق
                  </Button>
                )}

                {currentStep === 'review-queue' ? (
                  <Button
                    onClick={() => setCurrentStep('done')}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    ابدأ الآن
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      const stepOrder = ['welcome', 'create-campaign', 'add-leads', 'review-queue'];
                      const currentIndex = stepOrder.indexOf(currentStep);
                      if (currentIndex < stepOrder.length - 1) {
                        setCurrentStep(stepOrder[currentIndex + 1] as any);
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2"
                  >
                    التالي
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">الفريق</p>
                <p className="text-2xl font-bold text-gray-900">{team?.name || 'فريقي'}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600 opacity-20" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">الحملات</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <Target className="w-8 h-8 text-indigo-600 opacity-20" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">العملاء المحتملين</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <Users className="w-8 h-8 text-green-600 opacity-20" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">قائمة الانتظار</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600 opacity-20" />
            </div>
          </Card>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-600">
            <Target className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">الحملات</h3>
            <p className="text-sm text-gray-600 mb-4">
              أنشئ وأدر حملات LinkedIn الخاصة بك بسهولة
            </p>
            <a href="/dashboard/campaigns" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1">
              اذهب إلى الحملات <ArrowRight className="w-4 h-4" />
            </a>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-green-600">
            <Users className="w-8 h-8 text-green-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">العملاء المحتملين</h3>
            <p className="text-sm text-gray-600 mb-4">
              استعرض وأدر قائمة العملاء المحتملين بفعالية
            </p>
            <a href="/dashboard/leads" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1">
              اذهب إلى العملاء <ArrowRight className="w-4 h-4" />
            </a>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-orange-600">
            <Clock className="w-8 h-8 text-orange-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">قائمة الانتظار</h3>
            <p className="text-sm text-gray-600 mb-4">
              راجع واعتمد الإجراءات المعلقة بعناية وثقة
            </p>
            <a href="/dashboard/queue" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1">
              اذهب إلى القائمة <ArrowRight className="w-4 h-4" />
            </a>
          </Card>
        </div>
      </main>
    </div>
  );
}
