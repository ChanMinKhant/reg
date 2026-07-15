import { StudentFormProvider, useStudentFormContext } from '../hooks/useStudentForm';
import {
  EnrollmentSection,
  NamesRow,
  NrcRow,
  RaceRow,
  ReligionRow,
  PersonalRows,
  MatriculationRows,
  ParentOccupationRow,
  ContactRows,
  SignatureSection,
} from './FormRows';
import { PhotoUpload } from './PhotoUpload';

const td = 'border border-black px-2 py-1 text-sm align-middle';
const tdLabel = `${td} text-center font-medium`;

interface StudentRegistrationFormProps {
  onSubmitSuccess: (data: unknown) => void;
  isSubmitting?: boolean;
  photos?: any;
  onPhotoUpload?: (documentType: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadProgress?: Record<string, 'idle' | 'uploading' | 'error'>;
}

const StudentRegistrationFormContent = ({
  onSubmitSuccess,
  isSubmitting,
  photos,
  onPhotoUpload,
  uploadProgress,
}: StudentRegistrationFormProps) => {
  const {
    onSubmit,
    formError,
    setFormError,
    isEntranceLoading,
    isEntranceError,
    isProfileLoading,
  } = useStudentFormContext();

  /* ─── loading / error guards ─────────────────────────────────── */
  if (isEntranceLoading || isProfileLoading) {
    return (
      <div className='flex min-h-[400px] items-center justify-center'>
        <div className='flex flex-col items-center gap-3'>
          <div className='h-8 w-8 animate-spin rounded-full border-[3px] border-blue-600 border-t-transparent' />
          <p className='text-sm font-medium tracking-wide text-gray-500'>
            အချက်အလက်များ ရယူနေပါသည်...
          </p>
        </div>
      </div>
    );
  }

  if (isEntranceError) {
    return (
      <div className='flex min-h-[400px] items-center justify-center px-4'>
        <div className='w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center'>
          <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-500'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              strokeWidth={1.5}
              stroke='currentColor'
              className='w-6 h-6'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z'
              />
            </svg>
          </div>
          <h3 className='text-base font-semibold text-red-700 mb-1'>
            ခုံစာရင်း ရှာမတွေ့ပါ။
          </h3>
          <p className='text-sm text-red-600'>
            ကျေးဇူးပြု၍ နောက်တစ်ကြိမ် ကြိုးစားပါ။
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        if (!photos?.passportPhoto) {
          e.preventDefault();
          setFormError('Passport ဓာတ်ပုံ တင်ရန် လိုအပ်ပါသည်။ ❌');
          return;
        }
        onSubmit(e, onSubmitSuccess);
      }}
      className='font-myanmar'
    >
      {/* ── outer card ─────────────────────────────────────────────── */}
      <div
        className='border border-gray-400 rounded-lg bg-white p-5 mx-auto'
        style={{ maxWidth: 1000 }}
      >
        {/* ── Title ──────────────────────────────────────────────── */}
        <h2 className='text-center text-blue-600 font-bold text-lg mb-1'>
          University of Computer Studies, Pyay
        </h2>
        <h3 className='text-center font-semibold text-sm mb-0.5'>
          ကျောင်းသား/သူအဖြစ် မှတ်ပုံတင်ခွင့်တောင်းခံလွှာ
        </h3>
        <h3 className='text-center font-medium text-sm mb-4'>
          (ပထမနှစ်အတွက်သာ)
        </h3>

        {/* ── Top section: Enrollment table ── */}
        <div className='mb-6 flex items-start gap-8'>
          <div className='flex-shrink-0'>
            <PhotoUpload
              label='Passport ဓာတ်ပုံ တင်ရန်'
              preview={photos?.passportPhoto ? `/${photos.passportPhoto}` : ''}
              onChange={(e) => onPhotoUpload?.('passportPhoto', e)}
              isUploading={uploadProgress?.passportPhoto === 'uploading'}
              isError={uploadProgress?.passportPhoto === 'error'}
              width={120}
              height={160}
            />
          </div>
          <div className='flex-1 flex justify-end'>
            <EnrollmentSection width='400px' />
          </div>
        </div>

        {/* ── Error banner ────────────────────────────────────────── */}
        {formError && (
          <div className='mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700'>
            {formError}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            MAIN TABLE
            ══════════════════════════════════════════════════════════ */}
        <table className='w-full border-collapse text-sm text-center'>
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '27%' }} />
            <col style={{ width: '27%' }} />
            <col style={{ width: '27%' }} />
          </colgroup>

          {/* ── Header row ──────────────────────────────────────── */}
          <thead>
            <tr>
              <th className={`${tdLabel} font-bold`} colSpan={2}>
                အကြောင်းအရာ
              </th>
              <th className={tdLabel}>ကျောင်းသား/သူ</th>
              <th className={tdLabel}>အဘ</th>
              <th className={tdLabel}>အမိ</th>
            </tr>
          </thead>

          <tbody>
            <NamesRow />
            <NrcRow />
            <RaceRow />
            <ReligionRow />
            <PersonalRows />
            <MatriculationRows />
            <ParentOccupationRow />
            <ContactRows />
          </tbody>
        </table>

        {/* ── Signature section ─────────────────────────────────── */}
        <SignatureSection />
      </div>
      {/* /outer card */}

      {/* ── Submit button (outside card) ─────────────────────────── */}
      <div
        className='flex justify-end mt-5'
        style={{ maxWidth: 1000, margin: '20px auto 0' }}
      >
        <button
          type='submit'
          disabled={isSubmitting}
          className='flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed px-8 py-2.5 text-sm font-semibold text-white shadow-md transition-all'
        >
          {isSubmitting ? (
            <>
              <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
              တင်သွင်းနေသည်...
            </>
          ) : (
            'တင်သွင်းရန်'
          )}
        </button>
      </div>
    </form>
  );
};

export const StudentRegistrationForm = (props: StudentRegistrationFormProps) => {
  return (
    <StudentFormProvider>
      <StudentRegistrationFormContent {...props} />
    </StudentFormProvider>
  );
};
