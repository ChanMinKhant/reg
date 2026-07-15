import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { useAuthUser } from '@/features/auth/hooks/useAuthUser';
import { useEntranceQuery } from '@/features/entrance/hooks/useEntranceQueries';
import { useStudentProfileQuery } from './useStudentQueries';
import { useMatriValidation } from './useMatriValidation';
import { useEmailValidation } from './useEmailValidation';
import { usePhoneValidation } from './usePhoneValidation';
import type { NrcValue } from '../components/NrcInput';

import type { AddressValue } from '../components/AddressSelector';

export interface StudentFormValues {
  motherNameMm: string;
  nameEn: string;
  fatherNameEn: string;
  motherNameEn: string;
  studentNrc: NrcValue;
  fatherNrc: NrcValue;
  motherNrc: NrcValue;
  ethnicity: string;
  fatherEthnicity: string;
  motherEthnicity: string;
  religion: string;
  fatherReligion: string;
  motherReligion: string;
  dob: string;
  gender: string;
  entryAcademicYear: string;
  matriPlaceSelect: string;
  matriRollNumber: string;
  highSchoolName: string;
  fatherJob: string;
  motherJob: string;
  parentContact: AddressValue;
  parentPhone: string;
  studentContact: AddressValue;
  phoneNumber: string;
  stdEmail: string;
}

export const DEFAULT_FORM_VALUES: StudentFormValues = {
  motherNameMm: '',
  nameEn: '',
  fatherNameEn: '',
  motherNameEn: '',
  studentNrc: { region: '', city: '', prefix: '', number: '' },
  fatherNrc: { region: '', city: '', prefix: '', number: '' },
  motherNrc: { region: '', city: '', prefix: '', number: '' },
  ethnicity: '',
  fatherEthnicity: '',
  motherEthnicity: '',
  religion: '',
  fatherReligion: '',
  motherReligion: '',
  dob: '',
  gender: '',
  entryAcademicYear: '',
  matriPlaceSelect: '',
  matriRollNumber: '',
  highSchoolName: '',
  fatherJob: '',
  motherJob: '',
  parentContact: { state: '', district: '', township: '', address: '' },
  parentPhone: '',
  studentContact: { state: '', district: '', township: '', address: '' },
  phoneNumber: '',
  stdEmail: '',
};

interface StudentFormContextType {
  form: UseFormReturn<StudentFormValues>;
  photoPreview: string;
  setPhotoPreview: (url: string) => void;
  sigPreview: string;
  setSigPreview: (url: string) => void;
  entrance: any;
  isEntranceLoading: boolean;
  isEntranceError: boolean;
  isProfileLoading: boolean;
  formError: string;
  setFormError: (err: string) => void;
  emailMsg: { text: string; color: string };
  parentPhoneMsg: { text: string; color: string };
  studentPhoneMsg: { text: string; color: string };
  yearMsg: string;
  rollMsg: string;
  clearRollFields: () => void;
  onSubmit: (
    e: React.FormEvent,
    onSubmitSuccess: (payload: any) => void,
  ) => void;
}

const StudentFormContext = createContext<StudentFormContextType | null>(null);

/** Convert Myanmar gender label to DB enum */
const GENDER_MAP: Record<string, 'M' | 'F' | 'Other'> = {
  ကျား: 'M',
  မ: 'F',
};

export const StudentFormProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuthUser();
  const storageKey = user?.id ? `student_form_draft_${user.id}` : null;

  const [formError, setFormError] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [sigPreview, setSigPreview] = useState('');

  const {
    data: entrance,
    isLoading: isEntranceLoading,
    isError: isEntranceError,
  } = useEntranceQuery(true);

  const { data: dbProfileRes, isLoading: isProfileLoading } = useStudentProfileQuery(
    !!user?.hasStudentProfile
  );

  const form = useForm<StudentFormValues>({
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const { reset, watch, setValue, handleSubmit } = form;

  // Load draft from localStorage once storageKey is available
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Exclude photoPreview and sigPreview if they were accidentally saved
        delete parsed.photoPreview;
        delete parsed.sigPreview;
        reset(parsed);
      }
    } catch (e) {
      console.error('Failed to load student form draft:', e);
    }
  }, [storageKey, reset]);

  // Pre-populate form with database profile if no local storage draft exists
  useEffect(() => {
    if (!storageKey || !dbProfileRes?.ok || !dbProfileRes?.data) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        reset(dbProfileRes.data);
      }
    } catch (e) {
      console.error('Failed to pre-populate student form from DB:', e);
    }
  }, [dbProfileRes, storageKey, reset]);

  // Subscribe to all changes to save draft to localStorage (excluding photo/sig previews)
  useEffect(() => {
    if (!storageKey) return;
    const subscription = watch((values) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(values));
      } catch (e) {
        console.error('Failed to save student form draft:', e);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, storageKey]);

  // Watch fields needed for validation and feedback
  const entryAcademicYear = watch('entryAcademicYear');
  const matriPlaceSelect = watch('matriPlaceSelect');
  const matriRollNumber = watch('matriRollNumber');
  const stdEmail = watch('stdEmail');
  const parentPhone = watch('parentPhone');
  const phoneNumber = watch('phoneNumber');

  const clearRollFields = useCallback(() => {
    setValue('highSchoolName', '');
    setValue('matriRollNumber', '');
  }, [setValue]);

  // Validation Hooks
  const yearMsg = useMatriValidation(
    entryAcademicYear ?? '',
    matriPlaceSelect ?? '',
    matriRollNumber ?? '',
    clearRollFields,
    entrance?.examYear?.toString() ?? '',
    (entrance?.matricExamRollNo || '').split('-')[0]?.trim() ?? '',
    (entrance?.matricExamRollNo || '').split('-')[1]?.trim() ?? '',
  ).yearMsg;

  const rollMsg = useMatriValidation(
    entryAcademicYear ?? '',
    matriPlaceSelect ?? '',
    matriRollNumber ?? '',
    clearRollFields,
    entrance?.examYear?.toString() ?? '',
    (entrance?.matricExamRollNo || '').split('-')[0]?.trim() ?? '',
    (entrance?.matricExamRollNo || '').split('-')[1]?.trim() ?? '',
  ).rollMsg;

  const emailMsg = useEmailValidation(stdEmail ?? '');
  const parentPhoneMsg = usePhoneValidation(parentPhone ?? '');
  const studentPhoneMsg = usePhoneValidation(phoneNumber ?? '');

  const onSubmitHandler = (
    e: React.FormEvent,
    onSubmitSuccess: (payload: any) => void,
  ) => {
    e.preventDefault();
    setFormError('');

    handleSubmit((values) => {
      // Validation warning/error checks
      if (
        values.stdEmail &&
        emailMsg.text &&
        emailMsg.color.includes('text-red-600')
      ) {
        setFormError('အီးမေးလ်ပုံစံ မှားယွင်းနေပါသည်။ ❌');
        return;
      }
      if (yearMsg) {
        setFormError(yearMsg);
        return;
      }
      if (rollMsg) {
        setFormError(rollMsg);
        return;
      }

      // Basic required-field checks
      if (!values.nameEn.trim()) {
        setFormError('ကျောင်းသား/သူ အင်္ဂလိပ်အမည် ဖြည့်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }
      if (!values.motherNameMm.trim() || !values.motherNameEn.trim()) {
        setFormError('မိခင်အမည် ဖြည့်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }

      const nrcFilled = (n: NrcValue) =>
        !!(n.region && n.city && n.prefix && n.number);
      if (!nrcFilled(values.studentNrc)) {
        setFormError('ကျောင်းသား/သူ NRC ဖြည့်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }
      if (!nrcFilled(values.fatherNrc)) {
        setFormError('အဘ NRC ဖြည့်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }
      if (!nrcFilled(values.motherNrc)) {
        setFormError('အမိ NRC ဖြည့်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }

      if (!values.religion) {
        setFormError('ကျောင်းသား/သူ ဘာသာ ရွေးချယ်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }
      if (!values.fatherReligion || !values.motherReligion) {
        setFormError('မိဘ ဘာသာ ရွေးချယ်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }
      if (!values.dob) {
        setFormError('မွေးသက္ကရာဇ် ဖြည့်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }
      if (!values.gender) {
        setFormError('ကျား/မ ရွေးချယ်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }
      if (!values.entryAcademicYear) {
        setFormError(
          'တက္ကသိုလ်ဝင်တန်းအောင်မြင်သည့် ခုနှစ် ရွေးချယ်ရန် လိုအပ်ပါသည်။ ❌',
        );
        return;
      }
      if (!values.matriPlaceSelect || !values.matriRollNumber.trim()) {
        setFormError('ခုံအမှတ် ဖြည့်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }
      if (!values.highSchoolName.trim()) {
        setFormError('စာစစ်ဌာန ဖြည့်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }
      if (!values.fatherJob.trim() || !values.motherJob.trim()) {
        setFormError('မိဘ အလုပ်အကိုင် ဖြည့်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }

      const addrFilled = (a: AddressValue) =>
        !!(a.state && a.district && a.township && a.address.trim());
      if (!addrFilled(values.parentContact)) {
        setFormError('မိဘ လိပ်စာ အပြည့်အစုံ ဖြည့်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }
      const phoneRegex = /^[0-9]{8,11}$/;
      if (!values.parentPhone.trim()) {
        setFormError('မိဘ ဖုန်းနံပါတ် ဖြည့်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }
      if (!phoneRegex.test(values.parentPhone)) {
        setFormError(
          'မိဘ ဖုန်းနံပါတ်သည် အင်္ဂလိပ်ဂဏန်း ၈ လုံးမှ ၁၁ လုံးအထိသာ ဖြစ်ရပါမည်။ ❌',
        );
        return;
      }
      if (!addrFilled(values.studentContact)) {
        setFormError(
          'ကျောင်းသား/သူ လိပ်စာ အပြည့်အစုံ ဖြည့်ရန် လိုအပ်ပါသည်။ ❌',
        );
        return;
      }
      if (!values.phoneNumber.trim()) {
        setFormError('ကျောင်းသား/သူ ဖုန်းနံပါတ် ဖြည့်ရန် လိုအပ်ပါသည်။ ❌');
        return;
      }
      if (!phoneRegex.test(values.phoneNumber)) {
        setFormError(
          'ကျောင်းသား/သူ ဖုန်းနံပါတ်သည် အင်္ဂလိပ်ဂဏန်း ၈ လုံးမှ ၁၁ လုံးအထိသာ ဖြစ်ရပါမည်။ ❌',
        );
        return;
      }

      const payload = {
        nameMm: entrance?.applicantNameMm ?? '',
        nameEn: values.nameEn,
        fatherNameMm: entrance?.fatherNameMm ?? '',
        fatherNameEn: values.fatherNameEn,
        motherNameMm: values.motherNameMm,
        motherNameEn: values.motherNameEn,

        studentNrc: values.studentNrc,
        fatherNrc: values.fatherNrc,
        motherNrc: values.motherNrc,

        ethnicity: values.ethnicity,
        fatherEthnicity: values.fatherEthnicity,
        motherEthnicity: values.motherEthnicity,

        religion: values.religion,
        fatherReligion: values.fatherReligion,
        motherReligion: values.motherReligion,

        dob: values.dob,
        gender: GENDER_MAP[values.gender] ?? 'Other',

        entryAcademicYear: values.entryAcademicYear,
        matriPlaceSelect: values.matriPlaceSelect,
        matriRollNumber: values.matriRollNumber,
        highSchoolName: values.highSchoolName,

        fatherJob: values.fatherJob,
        motherJob: values.motherJob,

        parent_contact: values.parentContact,
        parentPhone: values.parentPhone,

        student_contact: values.studentContact,
        phoneNumber: values.phoneNumber,
        std_email: values.stdEmail,
      };

      onSubmitSuccess(payload);
    })(e);
  };

  return (
    <StudentFormContext.Provider
      value={{
        form,
        photoPreview,
        setPhotoPreview,
        sigPreview,
        setSigPreview,
        entrance,
        isEntranceLoading,
        isEntranceError,
        isProfileLoading,
        formError,
        setFormError,
        emailMsg,
        parentPhoneMsg,
        studentPhoneMsg,
        yearMsg,
        rollMsg,
        clearRollFields,
        onSubmit: onSubmitHandler,
      }}
    >
      {children}
    </StudentFormContext.Provider>
  );
};

export const useStudentFormContext = () => {
  const context = useContext(StudentFormContext);
  if (!context) {
    throw new Error(
      'useStudentFormContext must be used within StudentFormProvider',
    );
  }
  return context;
};
