import { X } from 'lucide-react';

interface FormulasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FormulasModal({ isOpen, onClose }: FormulasModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="formulas-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="formulas-title" className="text-base font-bold text-slate-900">
            مبانی و روابط فیزیکی شبیه‌سازی
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره روابط"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-5 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-slate-700">
          <div>
            <h3 className="mb-1 font-bold text-slate-900">
              ۱. اصل ارشمیدس و نیروی شناوری
            </h3>
            <p className="mb-2 text-xs text-slate-600">
              نیروی شناوری رو به بالا برابر است با وزن سیال جابه‌جا‌شده توسط بخش غوطه‌ور جسم و در مرکز حجم غوطه‌ور (مرکز شناوری) اعمال می‌شود:
            </p>
            <div
              dir="ltr"
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-center font-mono-num text-sm font-semibold text-emerald-800"
            >
              F_b = ρ_fluid · V_submerged · g
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="mb-1 font-bold text-slate-900">
              ۲. شرط شناوری، غوطه‌وری و وزن ظاهری
            </h3>
            <p className="mb-2 text-xs text-slate-600">
              اگر چگالی جسم کمتر از چگالی سیال باشد، جسم تا جایی فرو می‌رود که نیروی شناوری با وزن برابر شود. در آزمایش نیروسنج، وزن ظاهری داخل آب به اندازه نیروی شناوری کاهش می‌یابد:
            </p>
            <div
              dir="ltr"
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-center font-mono-num text-sm font-semibold text-sky-800"
            >
              W_apparent = F_g − F_b = (ρ_obj − ρ_fluid) · V · g
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="mb-1 font-bold text-slate-900">
              ۳. نیروی مقاومت سیال (پسا) و میرایی موج
            </h3>
            <p className="mb-2 text-xs text-slate-600">
              حرکت جسم درون سیال با نیروی مقاومتی متناسب با چگالی سیال، ویسکوزیته و مربع سرعت مخالفت می‌کند:
            </p>
            <div
              dir="ltr"
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-center font-mono-num text-sm font-semibold text-slate-800"
            >
              F_drag = ½ · ρ_fluid · C_d · A_sub · v² + k_visc · v
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="mb-1 font-bold text-slate-900">
              ۴. برخوردهای صلب و ضریب کشسانی
            </h3>
            <p className="mb-2 text-xs text-slate-600">
              ضریب کشسانی (e بین ۰ تا ۱) نسبت سرعت نسبی پس از برخورد به سرعت نسبی پیش از برخورد را مشخص می‌کند و اصطکاک سطح (μ) نیروی مماسی در تماس با سطوح شیب‌دار را تعیین می‌کند.
            </p>
            <div
              dir="ltr"
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-center font-mono-num text-sm font-semibold text-red-700"
            >
              e = |v_rel_after| / |v_rel_before|
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            متوجه شدم
          </button>
        </div>
      </div>
    </div>
  );
}
