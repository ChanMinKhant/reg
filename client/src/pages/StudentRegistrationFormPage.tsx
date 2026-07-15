import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudentRegistrationForm } from '@/features/studentForm/components/StudentRegistrationForm';
import {
  useSubmitStudentProfileMutation,
  useUploadStudentPhotoMutation,
  useUpdateStudentStatusMutation,
  useStudentPhotosQuery,
  useSubmitStudentPaymentMutation,
  useStudentPaymentQuery,
} from '@/features/studentForm/hooks/useStudentQueries';
import { useLogoutMutation, extractApiError } from '@/features/auth/hooks/useAuthQueries';
import { useAuthUser } from '@/features/auth/hooks/useAuthUser';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PhotoUpload } from '@/features/studentForm/components/PhotoUpload';

type Step = 'profile' | 'nrc_photos' | 'recommendations' | 'payment' | 'completed';

export const StudentRegistrationFormPage = () => {
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuthUser();
  const [activeStepOverride, setActiveStepOverride] = useState<Step | null>(null);
  const [pageError, setPageError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<Record<string, 'idle' | 'uploading' | 'error'>>({});

  const submitProfileMutation = useSubmitStudentProfileMutation();
  const uploadPhotoMutation = useUploadStudentPhotoMutation();
  const updateStatusMutation = useUpdateStudentStatusMutation();
  const logoutMutation = useLogoutMutation();

  // Fetch student photos once user ID is available
  const { data: photosRes, refetch: refetchPhotos } = useStudentPhotosQuery(
    user?.id ?? 0,
    !!user?.id
  );
  const photos = (photosRes && photosRes.ok) ? photosRes.data : {};

  // Step Calculation Logic based on user's application status
  const getActiveStep = (): Step => {
    if (activeStepOverride) return activeStepOverride;
    if (!user) return 'profile';
    const status = user.applicationStatus;
    if (status === 'PROFILE_COMPLETED') return 'nrc_photos';
    if (status === 'NRC_UPLOADED') return 'recommendations';
    if (status === 'DOCUMENTS_UPLOADED') return 'payment';
    if (['PAYMENT_SUBMITTED', 'APPROVED', 'REJECTED'].includes(status || '')) {
      return 'completed';
    }
    return 'profile';
  };

  const activeStep = getActiveStep();

  const handleProfileSubmitSuccess = (data: unknown) => {
    setPageError('');
    submitProfileMutation.mutate(data, {
      onSuccess: (res) => {
        if (res.ok) {
          if (user?.id) {
            localStorage.removeItem(`student_form_draft_${user.id}`);
          }
          setActiveStepOverride('nrc_photos');
        }
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        setPageError(
          apiError.message ?? 'ကိုယ်ရေးအချက်အလက် တင်သွင်းမှု မအောင်မြင်ပါ။ ကျေးဇူးပြု၍ ထပ်မံကြိုးစားပါ။'
        );
      },
    });
  };

  const handlePhotoUpload = (documentType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setUploadProgress((prev) => ({ ...prev, [documentType]: 'uploading' }));
    setPageError('');

    uploadPhotoMutation.mutate(
      { studentId: user.id, documentType, file },
      {
        onSuccess: (res) => {
          if (res.ok) {
            setUploadProgress((prev) => ({ ...prev, [documentType]: 'idle' }));
            refetchPhotos();
          }
        },
        onError: (err) => {
          setUploadProgress((prev) => ({ ...prev, [documentType]: 'error' }));
          const apiError = extractApiError(err);
          setPageError(`${file.name} အား တင်သွင်းရန် ကြိုးပမ်းမှု မအောင်မြင်ပါ- ${apiError.message}`);
        },
      }
    );
  };

  const handleNextToRecommendations = () => {
    setPageError('');
    updateStatusMutation.mutate('NRC_UPLOADED', {
      onSuccess: (res) => {
        if (res.ok) {
          setActiveStepOverride('recommendations');
        }
      },
      onError: (err) => {
        const apiError = extractApiError(err);
        setPageError(apiError.message ?? 'စနစ်ပိုင်းဆိုင်ရာ ချို့ယွင်းမှုဖြစ်ပွားခဲ့ပါသည်။');
      },
    });
  };

  const handleFinalSubmit = () => {
    setPageError('');
    updateStatusMutation.mutate('DOCUMENTS_UPLOADED', {
      onSuccess: (res) => {
        if (res.ok) {
          setActiveStepOverride('payment');
        }
      },
      onError: (err) => {
        const apiError = extractApiError(err);
        setPageError(apiError.message ?? 'စနစ်ပိုင်းဆိုင်ရာ ချို့ယွင်းမှုဖြစ်ပွားခဲ့ပါသည်။');
      },
    });
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        navigate('/', { replace: true });
      },
    });
  };

  if (isAuthLoading) {
    return <LoadingSpinner variant='blue' />;
  }

  // Stepper Header Component
  const renderStepper = () => {
    const steps = [
      { id: 'profile', label: 'ကိုယ်ရေးအချက်အလက်' },
      { id: 'nrc_photos', label: 'မှတ်ပုံတင်နှင့် ဓာတ်ပုံများ' },
      { id: 'recommendations', label: 'ထောက်ခံစာများနှင့် အောင်လက်မှတ်' },
      { id: 'payment', label: 'ငွေပေးချေမှု' },
      { id: 'completed', label: 'ပြီးမြောက်မှု' },
    ];

    const getStepIndex = (s: Step) => steps.findIndex((x) => x.id === s);
    const activeIndex = getStepIndex(activeStep);

    return (
      <div className='max-w-[1000px] mx-auto mb-8 px-4 font-myanmar'>
        <div className='flex items-center justify-between relative'>
          {/* Stepper background line */}
          <div className='absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-gray-200 z-0' />
          <div
            className='absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-600 transition-all duration-500 z-0'
            style={{ width: `${(activeIndex / (steps.length - 1)) * 100}%` }}
          />

          {steps.map((s, idx) => {
            const isCompleted = idx < activeIndex;
            const isActive = idx === activeIndex;

            return (
              <div key={s.id} className='flex flex-col items-center z-10 relative'>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 border-2 ${
                    isCompleted
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                      : isActive
                      ? 'bg-white border-blue-600 text-blue-600 shadow-md ring-4 ring-blue-50'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      fill='none'
                      viewBox='0 0 24 24'
                      strokeWidth={2.5}
                      stroke='currentColor'
                      className='w-5 h-5'
                    >
                      <path strokeLinecap='round' strokeLinejoin='round' d='m4.5 12.75 6 6 9-13.5' />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={`text-[11px] md:text-xs font-semibold mt-2.5 max-w-[120px] text-center leading-snug transition-all ${
                    isActive ? 'text-blue-600 font-bold' : isCompleted ? 'text-gray-600' : 'text-gray-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Step 2 Content: NRC Photos Upload
  const renderNrcPhotosStep = () => {
    const requiredPhotos = [
      { key: 'studentNrcPhotoFront', label: 'ကျောင်းသား/သူ မှတ်ပုံတင် (အရှေ့)' },
      { key: 'studentNrcPhotoBack', label: 'ကျောင်းသား/သူ မှတ်ပုံတင် (အနောက်)' },
      { key: 'fathNrcPhotoFront', label: 'ဖခင်ဖြစ်သူ မှတ်ပုံတင် (အရှေ့)' },
      { key: 'fathNrcPhotoBack', label: 'ဖခင်ဖြစ်သူ မှတ်ပုံတင် (အနောက်)' },
      { key: 'mothNrcPhotoFront', label: 'မိခင်ဖြစ်သူ မှတ်ပုံတင် (အရှေ့)' },
      { key: 'mothNrcPhotoBack', label: 'မိခင်ဖြစ်သူ မှတ်ပုံတင် (အနောက်)' },
    ];

    const photoGroups = [
      {
        title: 'ကျောင်းသား/သူ',
        items: [
          { key: 'studentNrcPhotoFront', label: 'မှတ်ပုံတင် (အရှေ့)' },
          { key: 'studentNrcPhotoBack', label: 'မှတ်ပုံတင် (အနောက်)' },
        ],
      },
      {
        title: 'ဖခင်ဖြစ်သူ',
        items: [
          { key: 'fathNrcPhotoFront', label: 'မှတ်ပုံတင် (အရှေ့)' },
          { key: 'fathNrcPhotoBack', label: 'မှတ်ပုံတင် (အနောက်)' },
        ],
      },
      {
        title: 'မိခင်ဖြစ်သူ',
        items: [
          { key: 'mothNrcPhotoFront', label: 'မှတ်ပုံတင် (အရှေ့)' },
          { key: 'mothNrcPhotoBack', label: 'မှတ်ပုံတင် (အနောက်)' },
        ],
      },
    ];

    const uploadedCount = requiredPhotos.filter((p) => !!photos[p.key]).length;
    const isAllUploaded = uploadedCount === requiredPhotos.length;

    return (
      <div className='max-w-[1000px] mx-auto bg-white border border-gray-200 shadow-xl rounded-2xl p-6 font-myanmar'>
        <div className='mb-6 border-b border-gray-100 pb-4'>
          <h2 className='text-xl font-bold text-gray-800 flex items-center gap-2'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              strokeWidth={1.5}
              stroke='currentColor'
              className='w-6 h-6 text-blue-600'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z'
              />
            </svg>
            နိုင်ငံသားစိစစ်ရေးကတ်နှင့် ဓာတ်ပုံများ တင်သွင်းရန်
          </h2>
          <p className='text-xs text-gray-500 mt-1.5 leading-relaxed'>
            ကျောင်းသား/သူ၊ ဖခင်နှင့် မိခင်တို့၏ မှတ်ပုံတင် အရှေ့/အနောက် ဓာတ်ပုံများအား တစ်ခုချင်းစီ သေချာစွာ ရွေးချယ်တင်သွင်းပေးရပါမည်။
          </p>
          <div className='mt-3 inline-flex items-center gap-2 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium'>
            တင်သွင်းပြီးမှု အခြေအနေ: {uploadedCount} / {requiredPhotos.length}
          </div>
        </div>

        <div className='flex flex-col gap-8 mb-8'>
          {photoGroups.map((group, idx) => (
            <div key={idx}>
              <h3 className='text-[15px] font-bold text-blue-700 mb-4 border-b border-gray-100 pb-2'>{group.title}</h3>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
                {group.items.map((p) => {
                  const hasUploaded = !!photos[p.key];
                  const state = uploadProgress[p.key] || 'idle';
                  const imgPath = photos[p.key] ? `/${photos[p.key]}` : '';

                  return (
                    <div
                      key={p.key}
                      className={`relative flex flex-col justify-between border rounded-xl p-4 transition-all duration-300 ${
                        hasUploaded
                          ? 'border-green-200 bg-green-50/20'
                          : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
                      }`}
                    >
                      <div>
                        <span className='text-xs font-bold text-gray-700 block mb-3 leading-snug'>{p.label}</span>
                        {hasUploaded ? (
                          <div className='relative w-full h-40 rounded-lg overflow-hidden border border-gray-100 bg-white mb-3'>
                            <img src={imgPath} alt={p.label} className='w-full h-full object-cover' />
                            <div className='absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-md'>
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                fill='none'
                                viewBox='0 0 24 24'
                                strokeWidth={3}
                                stroke='currentColor'
                                className='w-3.5 h-3.5'
                              >
                                <path strokeLinecap='round' strokeLinejoin='round' d='m4.5 12.75 6 6 9-13.5' />
                              </svg>
                            </div>
                          </div>
                        ) : (
                          <div className='w-full h-40 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-center p-4 mb-3 bg-white'>
                            {state === 'uploading' ? (
                              <div className='flex flex-col items-center gap-2'>
                                <span className='w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
                                <span className='text-[10px] text-gray-500'>တင်သွင်းနေပါသည်...</span>
                              </div>
                            ) : (
                              <>
                                <svg
                                  xmlns='http://www.w3.org/2000/svg'
                                  fill='none'
                                  viewBox='0 0 24 24'
                                  strokeWidth={1.2}
                                  stroke='currentColor'
                                  className='w-8 h-8 text-gray-400 mb-1'
                                >
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    d='M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z'
                                  />
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    d='M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z'
                                  />
                                </svg>
                                <span className='text-[10px] text-gray-400'>ဓာတ်ပုံရွေးချယ်ရန် နှိပ်ပါ</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className='mt-2'>
                        <label className='cursor-pointer w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 active:scale-[0.98] py-2 text-xs font-semibold text-gray-700 transition-all bg-white shadow-sm'>
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            fill='none'
                            viewBox='0 0 24 24'
                            strokeWidth={1.5}
                            stroke='currentColor'
                            className='w-4 h-4 text-gray-500'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              d='M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5'
                            />
                          </svg>
                          {hasUploaded ? 'ပုံပြန်ပြောင်းရန်' : 'ပုံရွေးချယ်တင်ရန်'}
                          <input
                            type='file'
                            accept='image/*'
                            onChange={(e) => handlePhotoChangeWithUpload(p.key, e)}
                            className='hidden'
                            disabled={state === 'uploading'}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className='flex justify-between items-center border-t border-gray-100 pt-5 mt-6'>
          <button
            onClick={() => setActiveStepOverride('profile')}
            className='rounded-full border border-gray-300 hover:bg-gray-50 active:scale-[0.98] px-6 py-2.5 text-xs md:text-sm font-semibold text-gray-700 transition-all'
          >
            ကိုယ်ရေးအချက်အလက် ပြင်ဆင်ရန်
          </button>
          <button
            onClick={handleNextToRecommendations}
            disabled={!isAllUploaded || updateStatusMutation.isPending}
            className='flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed px-8 py-2.5 text-xs md:text-sm font-semibold text-white shadow-md transition-all'
          >
            {updateStatusMutation.isPending ? (
              <>
                <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
                လုပ်ဆောင်နေသည်...
              </>
            ) : (
              <>
                ရှေ့သို့ဆက်သွားရန်
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                  strokeWidth={2}
                  stroke='currentColor'
                  className='w-4 h-4'
                >
                  <path strokeLinecap='round' strokeLinejoin='round' d='M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3' />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // Step 3 Content: Recommendation Letters
  const renderRecommendationsStep = () => {
    const requiredDocs = [
      { key: 'quarterApprovedLetter', label: 'ရပ်ကွက်ထောက်ခံစာ ဓာတ်ပုံ' },
      { key: 'policeApprovedLetter', label: 'ရဲစခန်းထောက်ခံစာ ဓာတ်ပုံ' },
      { key: 'medicalCertificate', label: 'ဆေးထောက်ခံစာ ဓာတ်ပုံ' },
      { key: 'houseRegistrationPhoto', label: 'အိမ်ထောင်စုဇယား ဓာတ်ပုံ' },
      { key: 'matriculationCertificate', label: 'တက္ကသိုလ်ဝင်တန်း အောင်လက်မှတ် ဓာတ်ပုံ' },
      { key: 'matriculationMarkPhoto', label: 'တက္ကသိုလ်ဝင်တန်း အမှတ်စာရင်း ဓာတ်ပုံ' },
    ];

    const uploadedCount = requiredDocs.filter((p) => !!photos[p.key]).length;
    const isAllUploaded = uploadedCount === requiredDocs.length;

    return (
      <div className='max-w-[1000px] mx-auto bg-white border border-gray-200 shadow-xl rounded-2xl p-6 font-myanmar'>
        <div className='mb-6 border-b border-gray-100 pb-4'>
          <h2 className='text-xl font-bold text-gray-800 flex items-center gap-2'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              strokeWidth={1.5}
              stroke='currentColor'
              className='w-6 h-6 text-blue-600'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'
              />
            </svg>
            လိုအပ်သော ထောက်ခံစာများနှင့် လက်မှတ်များ တင်သွင်းရန်
          </h2>
          <p className='text-xs text-gray-500 mt-1.5 leading-relaxed'>
            ကျေးဇူးပြု၍ သက်ဆိုင်ရာ ရပ်ကွက်၊ ရဲစခန်းနှင့် ကျန်းမာရေးဌာနတို့မှ ရရှိထားသော ထောက်ခံစာမူရင်း ဓာတ်ပုံများနှင့် တက္ကသိုလ်ဝင်တန်းအောင် အချက်အလက်များအား ပြတ်သားကြည်လင်စွာ ရိုက်ကူး၍ တင်သွင်းပေးပါ။
          </p>
          <div className='mt-3 inline-flex items-center gap-2 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium'>
            တင်သွင်းပြီးမှု အခြေအနေ: {uploadedCount} / {requiredDocs.length}
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 mb-8'>
          {requiredDocs.map((p) => {
            const hasUploaded = !!photos[p.key];
            const state = uploadProgress[p.key] || 'idle';
            const imgPath = photos[p.key] ? `/${photos[p.key]}` : '';

            return (
              <div
                key={p.key}
                className={`relative flex flex-col justify-between border rounded-xl p-4 transition-all duration-300 ${
                  hasUploaded
                    ? 'border-green-200 bg-green-50/20'
                    : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
                }`}
              >
                <div>
                  <span className='text-xs font-bold text-gray-700 block mb-3 leading-snug'>{p.label}</span>
                  {hasUploaded ? (
                    <div className='relative w-full h-36 rounded-lg overflow-hidden border border-gray-100 bg-white mb-3'>
                      <img src={imgPath} alt={p.label} className='w-full h-full object-cover' />
                      <div className='absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-md'>
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          fill='none'
                          viewBox='0 0 24 24'
                          strokeWidth={3}
                          stroke='currentColor'
                          className='w-3.5 h-3.5'
                        >
                          <path strokeLinecap='round' strokeLinejoin='round' d='m4.5 12.75 6 6 9-13.5' />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <div className='w-full h-36 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-center p-4 mb-3 bg-white'>
                      {state === 'uploading' ? (
                        <div className='flex flex-col items-center gap-2'>
                          <span className='w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
                          <span className='text-[10px] text-gray-500'>တင်သွင်းနေပါသည်...</span>
                        </div>
                      ) : (
                        <>
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            fill='none'
                            viewBox='0 0 24 24'
                            strokeWidth={1.2}
                            stroke='currentColor'
                            className='w-8 h-8 text-gray-400 mb-1'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              d='M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'
                            />
                          </svg>
                          <span className='text-[10px] text-gray-400'>ထောက်ခံစာရွေးချယ်ရန် နှိပ်ပါ</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className='mt-2'>
                  <label className='cursor-pointer w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 active:scale-[0.98] py-2 text-xs font-semibold text-gray-700 transition-all bg-white shadow-sm'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      fill='none'
                      viewBox='0 0 24 24'
                      strokeWidth={1.5}
                      stroke='currentColor'
                      className='w-4 h-4 text-gray-500'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5'
                      />
                    </svg>
                    {hasUploaded ? 'ပုံပြန်ပြောင်းရန်' : 'ပုံရွေးချယ်တင်ရန်'}
                    <input
                      type='file'
                      accept='image/*'
                      onChange={(e) => handlePhotoChangeWithUpload(p.key, e)}
                      className='hidden'
                      disabled={state === 'uploading'}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className='flex justify-between items-center border-t border-gray-100 pt-5 mt-6'>
          <button
            onClick={() => setActiveStepOverride('nrc_photos')}
            className='flex items-center gap-1.5 rounded-full border border-gray-300 hover:bg-gray-50 active:scale-[0.98] px-6 py-2.5 text-xs md:text-sm font-semibold text-gray-700 transition-all'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              strokeWidth={2}
              stroke='currentColor'
              className='w-4 h-4'
            >
              <path strokeLinecap='round' strokeLinejoin='round' d='M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18' />
            </svg>
            နောက်သို့ပြန်သွားရန်
          </button>
          <button
            onClick={handleFinalSubmit}
            disabled={!isAllUploaded || updateStatusMutation.isPending}
            className='flex items-center gap-2 rounded-full bg-green-600 hover:bg-green-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed px-8 py-2.5 text-xs md:text-sm font-semibold text-white shadow-md transition-all'
          >
            {updateStatusMutation.isPending ? (
              <>
                <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
                လျှောက်လွှာတင်သွင်းနေပါသည်...
              </>
            ) : (
              <>
                လျှောက်လွှာ အပြီးသတ်တင်သွင်းရန်
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                  strokeWidth={2.5}
                  stroke='currentColor'
                  className='w-4 h-4'
                >
                  <path strokeLinecap='round' strokeLinejoin='round' d='m4.5 12.75 6 6 9-13.5' />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // Helper function to process file input change and invoke mutation
  const handlePhotoChangeWithUpload = (documentType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    handlePhotoUpload(documentType, e);
  };

  // Step 4 Content: Completed / Review Page

  // Step 5 Content: Completed / Review Page
  const renderCompletedStep = () => {
    return (
      <div className='max-w-[650px] mx-auto bg-white border border-gray-200 shadow-2xl rounded-2xl p-8 font-myanmar text-center'>
        <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mb-6 animate-bounce'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            strokeWidth={2.5}
            stroke='currentColor'
            className='w-9 h-9'
          >
            <path strokeLinecap='round' strokeLinejoin='round' d='m4.5 12.75 6 6 9-13.5' />
          </svg>
        </div>

        <h2 className='text-2xl font-bold text-gray-800 mb-3'>
          လျှောက်လွှာအား အပြီးသတ်တင်သွင်းပြီးပါပြီ။
        </h2>
        <p className='text-sm text-gray-500 mb-8 max-w-md mx-auto leading-relaxed'>
          ပထမနှစ်ကျောင်းသားအဖြစ် မှတ်ပုံတင်ခွင့်တောင်းခံလွှာ၊ စာရွက်စာတမ်းများနှင့် ငွေပေးချေမှုပြေစာအားလုံးကို စနစ်ထဲသို့ အောင်မြင်စွာ တင်သွင်းပြီးဖြစ်ပါသည်။
        </p>

        {/* Timeline Progress */}
        <div className='text-left border border-gray-150 rounded-xl bg-gray-50/50 p-5 mb-8 max-w-md mx-auto'>
          <h4 className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2'>
            လျှောက်လွှာ တိုးတက်မှု အခြေအနေ
          </h4>

          <div className='space-y-6'>
            {/* Step 1 in Timeline */}
            <div className='flex gap-3'>
              <div className='flex flex-col items-center'>
                <div className='w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px]'>
                  ✓
                </div>
                <div className='w-0.5 h-10 bg-green-500' />
              </div>
              <div>
                <h5 className='text-xs font-bold text-gray-800'>ကိုယ်ရေးအချက်အလက် တင်သွင်းမှု</h5>
                <p className='text-[10px] text-gray-500 mt-0.5'>အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။</p>
              </div>
            </div>

            {/* Step 2 in Timeline */}
            <div className='flex gap-3'>
              <div className='flex flex-col items-center'>
                <div className='w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px]'>
                  ✓
                </div>
                <div className='w-0.5 h-10 bg-green-500' />
              </div>
              <div>
                <h5 className='text-xs font-bold text-gray-800'>စာရွက်စာတမ်းနှင့် ထောက်ခံစာများ တင်သွင်းမှု</h5>
                <p className='text-[10px] text-gray-500 mt-0.5'>လိုအပ်သော ဓာတ်ပုံများနှင့် ထောက်ခံစာများ အားလုံး တင်သွင်းပြီးပါပြီ။</p>
              </div>
            </div>

            {/* Step 3 in Timeline */}
            <div className='flex gap-3'>
              <div className='flex flex-col items-center'>
                <div className='w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px]'>
                  ✓
                </div>
                <div className='w-0.5 h-10 bg-green-500' />
              </div>
              <div>
                <h5 className='text-xs font-bold text-gray-800'>ကျောင်းအပ်နှံခ ငွေပေးချေမှု</h5>
                <p className='text-[10px] text-gray-500 mt-0.5'>ငွေပေးချေမှုပြေစာအား အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။</p>
              </div>
            </div>

            {/* Step 4 in Timeline (In progress) */}
            <div className='flex gap-3'>
              <div className='flex flex-col items-center'>
                <div className='w-5 h-5 rounded-full bg-blue-100 border border-blue-500 text-blue-600 flex items-center justify-center animate-pulse text-[10px] font-bold'>
                  ●
                </div>
                <div className='w-0.5 h-10 bg-gray-200' />
              </div>
              <div>
                <h5 className='text-xs font-bold text-blue-600'>လျှောက်လွှာအား စိစစ်စစ်ဆေးနေခြင်း</h5>
                <p className='text-[10px] text-gray-500 mt-0.5'>ဌာနမှ တင်သွင်းလာသော အချက်အလက်များအား စိစစ်နေဆဲဖြစ်ပါသည်...</p>
              </div>
            </div>

            {/* Step 5 in Timeline (Future) */}
            <div className='flex gap-3 opacity-55'>
              <div className='flex flex-col items-center'>
                <div className='w-5 h-5 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center text-[10px] font-bold'>
                  5
                </div>
              </div>
              <div>
                <h5 className='text-xs font-bold text-gray-600'>ကျောင်းအပ်နှံခွင့် အတည်ပြုခြင်း</h5>
                <p className='text-[10px] text-gray-400 mt-0.5'>စိစစ်ပြီးပါက အတည်ပြုချက် ထုတ်ပြန်ပေးပါမည်။</p>
              </div>
            </div>
          </div>
        </div>

        <div className='flex gap-3 justify-center'>
          <button
            onClick={() => setActiveStepOverride('profile')}
            className='rounded-full border border-gray-300 hover:bg-gray-100 px-6 py-2 text-xs font-semibold text-gray-700 transition-all'
          >
            တင်သွင်းခဲ့သော အချက်အလက်များ ပြန်ကြည့်ရန်
          </button>
          <button
            onClick={handleLogout}
            className='rounded-full bg-blue-600 hover:bg-blue-700 px-6 py-2 text-xs font-semibold text-white shadow-sm transition-all'
          >
            စနစ်မှ ထွက်ခွာမည်
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className='min-h-screen bg-gray-100 flex flex-col'>
      {/* Navbar Header */}
      <header className='bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20 font-myanmar'>
        <div className='mx-auto flex max-w-[1040px] items-center justify-between px-4 py-3'>
          <div className='flex items-center gap-2 text-blue-600 font-bold text-sm'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              strokeWidth={1.5}
              stroke='currentColor'
              className='w-5 h-5'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z'
              />
            </svg>
            <span>UCSPyay Student Portal</span>
          </div>
          <button
            onClick={handleLogout}
            className='flex items-center gap-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 px-3.5 py-2 text-xs font-semibold text-gray-600 transition-all'
          >
            ထွက်ခွာရန်
          </button>
        </div>
      </header>

      {/* Global Error Banner */}
      {pageError && (
        <div className='max-w-[1000px] w-full mx-auto mt-4 px-4 font-myanmar'>
          <div className='rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-xs md:text-sm text-red-700 flex items-center gap-2 shadow-sm'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              strokeWidth={2}
              stroke='currentColor'
              className='w-5 h-5 flex-shrink-0'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z'
              />
            </svg>
            <span>{pageError}</span>
          </div>
        </div>
      )}

      {/* Stepper Header */}
      <div className='mt-6'>{renderStepper()}</div>

      {/* Active Step Panel */}
      <main className='flex-1 pb-12 px-4'>
        {activeStep === 'profile' && (
          <StudentRegistrationForm
            onSubmitSuccess={handleProfileSubmitSuccess}
            isSubmitting={submitProfileMutation.isPending}
            photos={photos}
            onPhotoUpload={handlePhotoUpload}
            uploadProgress={uploadProgress}
          />
        )}
        {activeStep === 'nrc_photos' && renderNrcPhotosStep()}
        {activeStep === 'recommendations' && renderRecommendationsStep()}
        {activeStep === 'payment' && (
          <PaymentStep user={user} setActiveStepOverride={setActiveStepOverride} />
        )}
        {activeStep === 'completed' && renderCompletedStep()}
      </main>
    </div>
  );
};

interface PaymentStepProps {
  user: any;
  setActiveStepOverride: (step: Step) => void;
}

const PaymentStep = ({ user, setActiveStepOverride }: PaymentStepProps) => {
  const [payerName, setPayerName] = useState('');
  const [transactionCode, setTransactionCode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [localError, setLocalError] = useState('');

  const submitPaymentMutation = useSubmitStudentPaymentMutation();
  const { data: paymentRes, isLoading: isPaymentLoading } = useStudentPaymentQuery(
    user?.applicationStatus === 'PAYMENT_SUBMITTED'
  );
  const existingPayment = paymentRes && paymentRes.ok ? paymentRes.data : null;

  useEffect(() => {
    if (existingPayment) {
      setPayerName(existingPayment.payerName);
      setTransactionCode(existingPayment.transactionCode);
      setPreviewUrl(`/${existingPayment.paymentScreenshot}`);
    }
  }, [existingPayment]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handlePaymentSubmit = () => {
    setLocalError('');
    if (!payerName.trim()) {
      setLocalError('ငွေလွှဲသူအမည် ဖြည့်ရန်လိုအပ်ပါသည်။');
      return;
    }
    if (!transactionCode.trim()) {
      setLocalError('နောက်ဆုံးဂဏန်း ၆ လုံး ဖြည့်ရန်လိုအပ်ပါသည်။');
      return;
    }
    if (transactionCode.length !== 6 || !/^\d+$/.test(transactionCode)) {
      setLocalError('ငွေလွှဲကုဒ်သည် ဂဏန်း ၆ လုံး ဖြစ်ရပါမည်။');
      return;
    }
    if (!file && !existingPayment) {
      setLocalError('ငွေလွှဲပြေစာ ဓာတ်ပုံ တင်ရန်လိုအပ်ပါသည်။');
      return;
    }

    submitPaymentMutation.mutate(
      {
        payerName,
        transactionCode,
        file: file!,
      },
      {
        onSuccess: (res) => {
          if (res.ok) {
            setActiveStepOverride('completed');
          }
        },
        onError: (err) => {
          const apiError = extractApiError(err);
          setLocalError(apiError.message ?? 'ငွေပေးချေမှု တင်သွင်းခြင်း မအောင်မြင်ပါ။');
        },
      }
    );
  };

  const isSubmitted = user?.applicationStatus === 'PAYMENT_SUBMITTED' || !!existingPayment;

  return (
    <div className='max-w-[800px] mx-auto bg-white border border-gray-200 rounded-2xl p-6 shadow-sm font-myanmar'>
      <h3 className='text-lg font-bold text-gray-800 border-b border-gray-100 pb-3 mb-4'>
        ကျောင်းအပ်နှံခ ငွေပေးချေရန်
      </h3>

      {/* Info card */}
      <div className='bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-800 leading-relaxed'>
        <p className='font-bold mb-1.5'>⚠️ ငွေပေးချေမှု လမ်းညွှန်ချက် -</p>
        <p>ကျောင်းအပ်နှံခ ၁၅,၀၀၀ ကျပ် အား အောက်ဖော်ပြပါ ငွေစာရင်း တစ်ခုခုသို့ လွှဲပေးပါရန် -</p>
        <div className='mt-2.5 space-y-1.5 font-medium pl-2'>
          <p>• KBZPay Account: <span className='font-bold text-blue-900'>09 123 456 789</span> (U Kyaw Kyaw)</p>
          <p>• WavePay Account: <span className='font-bold text-blue-900'>09 123 456 789</span> (U Kyaw Kyaw)</p>
          <p>• KBZ Bank: <span className='font-bold text-blue-900'>123-456-789-0123-4567</span> (U Kyaw Kyaw)</p>
        </div>
        <p className='mt-3 font-semibold text-red-600'>
          * ငွေလွှဲပြေစာ ဓာတ်ပုံ တင်ရန်နှင့် ငွေလွှဲကုဒ်၏ နောက်ဆုံးဂဏန်း ၆ လုံး (last 6 digits) ကို တိကျစွာ ဖြည့်သွင်းပေးပါရန်။
        </p>
      </div>

      {localError && (
        <div className='bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs font-semibold text-red-700'>
          ❌ {localError}
        </div>
      )}

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 items-start'>
        {/* Form inputs */}
        <div className='md:col-span-2 space-y-4'>
          <div>
            <label className='block text-xs font-semibold text-gray-600 mb-1.5'>
              ငွေလွှဲသူအမည် (Payer Name)
            </label>
            <input
              type='text'
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              disabled={isSubmitted || isPaymentLoading}
              placeholder='ဥပမာ - U Kyaw Kyaw'
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50'
            />
          </div>

          <div>
            <label className='block text-xs font-semibold text-gray-600 mb-1.5'>
              ငွေလွှဲကုဒ်၏ နောက်ဆုံး ဂဏန်း ၆ လုံး (Transaction Code - Last 6 digits)
            </label>
            <input
              type='text'
              value={transactionCode}
              onChange={(e) => setTransactionCode(e.target.value)}
              disabled={isSubmitted || isPaymentLoading}
              placeholder='ဥပမာ - 123456'
              maxLength={6}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50'
            />
          </div>
        </div>

        {/* Photo upload */}
        <div className='flex flex-col items-center justify-center'>
          <label className='block text-xs font-semibold text-gray-600 mb-2 text-center w-full'>
            ငွေလွှဲပြေစာ တင်ရန် (Payment Screenshot)
          </label>
          <PhotoUpload
            label='ပြေစာ တင်ရန်'
            preview={previewUrl}
            onChange={handleFileChange}
            isUploading={submitPaymentMutation.isPending}
            isError={false}
            width={150}
            height={200}
          />
        </div>
      </div>

      <div className='flex justify-between items-center border-t border-gray-100 pt-5 mt-6'>
        <button
          onClick={() => setActiveStepOverride('recommendations')}
          disabled={isSubmitted || submitPaymentMutation.isPending}
          className='rounded-full border border-gray-300 hover:bg-gray-50 active:scale-[0.98] px-6 py-2.5 text-xs md:text-sm font-semibold text-gray-700 transition-all disabled:opacity-50'
        >
          နောက်သို့ပြန်သွားရန်
        </button>
        {!isSubmitted && (
          <button
            onClick={handlePaymentSubmit}
            disabled={submitPaymentMutation.isPending}
            className='flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 px-8 py-2.5 text-xs md:text-sm font-semibold text-white shadow-md transition-all'
          >
            {submitPaymentMutation.isPending ? (
              <>
                <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
                တင်သွင်းနေသည်...
              </>
            ) : (
              'ငွေပေးချေမှု တင်သွင်းရန်'
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default StudentRegistrationFormPage;
