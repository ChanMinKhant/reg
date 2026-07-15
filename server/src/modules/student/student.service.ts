import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/data-source';
import { StudentProfile } from '../../database/entities/StudentProfile';
import { ParentProfile } from '../../database/entities/ParentProfile';
import { Account } from '../../database/entities/Account';
import { Photo } from '../../database/entities/Photo';
import { Address } from '../../database/entities/Address';
import { State } from '../../database/entities/State';
import { District } from '../../database/entities/District';
import { Township } from '../../database/entities/Township';
import { AcademicYear } from '../../database/entities/AcademicYear';
import { Semester } from '../../database/entities/Semester';
import { Major } from '../../database/entities/Major';
import { SemesterRegistration } from '../../database/entities/SemesterRegistration';
import { Payment } from '../../database/entities/Payment';
import { EntranceRegistration } from '../../database/entities/EntranceRegistration';
import AppError from '../../common/utils/AppError';
import type { StudentProfileInput, UpdateStatusInput } from './student.schema';

const AccountRepository = AppDataSource.getRepository(Account);
const PhotoRepository = AppDataSource.getRepository(Photo);

export class StudentService {
  /**
   * Saves or updates the student registration profile submitted from the dashboard form.
   * Resolves state/district/township names → IDs, writes StudentProfile,
   * ParentProfile, and two Address records in a single transaction.
   */
  async saveStudentProfile(
    accountId: number,
    data: StudentProfileInput,
  ): Promise<StudentProfile> {
    const buildNrc = (n: typeof data.studentNrc): string =>
      `${n.region}/${n.city}(${n.prefix})${n.number}`;

    const studentNrc = buildNrc(data.studentNrc);
    const fatherNrc = buildNrc(data.fatherNrc);
    const motherNrc = buildNrc(data.motherNrc);

    const highSchoolRollNo = `${data.matriPlaceSelect}-${data.matriRollNumber}`;

    const genderMap: Record<string, 'M' | 'F' | 'Other'> = {
      ကျား: 'M',
      မ: 'F',
    };
    const gender: 'M' | 'F' | 'Other' =
      genderMap[data.gender] ?? (data.gender as 'M' | 'F' | 'Other');

    const account = await AccountRepository.findOne({
      where: { id: accountId },
      select: ['entranceId'],
    });

    const resolveLocationIds = async (
      manager: typeof AppDataSource.manager,
      contact: typeof data.student_contact,
    ): Promise<{ stateId: string; districtId: string; townshipId: string }> => {
      const stateRepo = manager.getRepository(State);
      const districtRepo = manager.getRepository(District);
      const townshipRepo = manager.getRepository(Township);

      const state = await stateRepo.findOne({
        where: { nameMm: contact.state },
      });
      if (!state)
        throw AppError.badRequest(`State not found: ${contact.state}`);

      const district = await districtRepo.findOne({
        where: { stateId: state.stateId, nameMm: contact.district },
      });
      if (!district)
        throw AppError.badRequest(`District not found: ${contact.district}`);

      const township = await townshipRepo.findOne({
        where: {
          stateId: state.stateId,
          districtId: district.districtId,
          nameMm: contact.township,
        },
      });
      if (!township)
        throw AppError.badRequest(`Township not found: ${contact.township}`);

      return {
        stateId: state.stateId,
        districtId: district.districtId,
        townshipId: township.townshipId,
      };
    };

    const savedProfile = await AppDataSource.transaction(async (manager) => {
      const studentProfileRepo = manager.getRepository(StudentProfile);
      const parentProfileRepo = manager.getRepository(ParentProfile);
      const addressRepo = manager.getRepository(Address);
      const accountRepo = manager.getRepository(Account);

      const studentLocIds = await resolveLocationIds(
        manager,
        data.student_contact,
      );
      const parentLocIds = await resolveLocationIds(
        manager,
        data.parent_contact,
      );

      let profile = await studentProfileRepo.findOne({
        where: { studentId: accountId },
      });
      if (!profile) {
        profile = studentProfileRepo.create({
          studentId: accountId,
        } as Partial<StudentProfile> as StudentProfile);
      }

      profile.nameMm = data.nameMm;
      profile.nameEn = data.nameEn;
      profile.gender = gender;
      profile.dob = new Date(data.dob) as unknown as Date;
      profile.phoneNumber = data.phoneNumber;
      profile.studentNrc = studentNrc;
      profile.ethnicity = data.ethnicity || undefined;
      profile.religion = data.religion || undefined;
      profile.highSchoolRollNo = highSchoolRollNo;
      profile.highSchoolName = data.highSchoolName || undefined;
      profile.entryAcademicYear = data.entryAcademicYear || undefined;
      profile.entranceId = account?.entranceId || undefined;

      const savedStudentProfile = await studentProfileRepo.save(profile);

      let parentProfile = await parentProfileRepo.findOne({
        where: { studentId: accountId },
      });
      if (!parentProfile) {
        parentProfile = parentProfileRepo.create({
          studentId: accountId,
        } as Partial<ParentProfile> as ParentProfile);
      }

      parentProfile.fatherNameMm = data.fatherNameMm;
      parentProfile.fatherNameEn = data.fatherNameEn;
      parentProfile.fatherNrc = fatherNrc || undefined;
      parentProfile.fatherEthnicity = data.fatherEthnicity || undefined;
      parentProfile.fatherReligion = data.fatherReligion || undefined;
      parentProfile.fatherJob = data.fatherJob || undefined;
      parentProfile.motherNameMm = data.motherNameMm;
      parentProfile.motherNameEn = data.motherNameEn;
      parentProfile.motherNrc = motherNrc || undefined;
      parentProfile.motherEthnicity = data.motherEthnicity || undefined;
      parentProfile.motherReligion = data.motherReligion || undefined;
      parentProfile.motherJob = data.motherJob || undefined;
      parentProfile.parentPhone = data.parentPhone || undefined;

      await parentProfileRepo.save(parentProfile);

      await addressRepo.delete({
        student: { studentId: accountId },
        type: 'current',
      });
      await addressRepo.delete({
        student: { studentId: accountId },
        type: 'parent',
      });

      const studentAddr = addressRepo.create({
        type: 'current',
        streetAddress: data.student_contact.address,
        stateId: studentLocIds.stateId,
        districtId: studentLocIds.districtId,
        townshipId: studentLocIds.townshipId,
        student: savedStudentProfile,
      });
      await addressRepo.save(studentAddr);

      const parentAddr = addressRepo.create({
        type: 'parent',
        streetAddress: data.parent_contact.address,
        stateId: parentLocIds.stateId,
        districtId: parentLocIds.districtId,
        townshipId: parentLocIds.townshipId,
        student: savedStudentProfile,
      });
      await addressRepo.save(parentAddr);

      // 1. Get active academic year
      const academicYearRepo = manager.getRepository(AcademicYear);
      const activeYear = await academicYearRepo.findOne({ where: { isActive: true } });

      // 2. Get first semester (numerical level 1)
      const semesterRepo = manager.getRepository(Semester);
      const firstSemester = await semesterRepo.findOne({ where: { numericalLevel: 1 } });

      // 3. Get student major code based on entrance registration
      const entranceRepo = manager.getRepository(EntranceRegistration);
      const entrance = account?.entranceId
        ? await entranceRepo.findOne({ where: { entranceId: account.entranceId } })
        : null;
      const studentMajorCode = entrance?.majorCode || 'CST';

      const majorRepo = manager.getRepository(Major);
      const major = await majorRepo.findOne({ where: { majorCode: studentMajorCode } });

      if (!activeYear || !firstSemester || !major) {
        throw AppError.badRequest('ကျောင်းအပ်နှံရန် semester သို့မဟုတ် major ဖွင့်လှစ်ထားခြင်း မရှိသေးပါ။');
      }

      // 4. Create or get SemesterRegistration
      const registrationRepo = manager.getRepository(SemesterRegistration);
      let registration = await registrationRepo.findOne({
        where: {
          studentId: accountId,
          academicYearId: activeYear.academicYearId,
          semesterId: firstSemester.semesterId,
        },
      });

      if (!registration) {
        registration = registrationRepo.create({
          studentId: accountId,
          academicYearId: activeYear.academicYearId,
          semesterId: firstSemester.semesterId,
          majorCode: studentMajorCode,
        });
        await registrationRepo.save(registration);
      }

      // Update Account Status
      await accountRepo.update({ id: accountId }, { applicationStatus: 'PROFILE_COMPLETED' });

      return savedStudentProfile;
    });

    return savedProfile;
  }

  async updateAccountStatus(accountId: number, data: UpdateStatusInput): Promise<Account> {
    const account = await AccountRepository.findOne({ where: { id: accountId } });
    if (!account) {
      throw AppError.notFound('Account not found');
    }
    
    account.applicationStatus = data.status;
    await AccountRepository.save(account);
    return account;
  }

  async getPhotos(studentId: number): Promise<Photo | null> {
    return await PhotoRepository.findOne({ where: { studentId } });
  }

  async savePhoto(
    studentId: number,
    documentType: string,
    filePath: string
  ): Promise<Photo> {
    let photo = await PhotoRepository.findOne({ where: { studentId } });
    
    if (!photo) {
      photo = new Photo();
      photo.studentId = studentId;
    }

    const typeMapping: { [key: string]: keyof Photo } = {
      passportPhoto: 'passportPhoto',
      houseRegistrationPhoto: 'houseRegistrationPhoto',
      matriculationMarkPhoto: 'matriculationMarkPhoto',
      matriculationCertificate: 'matriculationCertificate',
      policeApprovedLetter: 'policeApprovedLetter',
      quarterApprovedLetter: 'quarterApprovedLetter',
      medicalCertificate: 'medicalCertificate',
      studentNrcPhotoFront: 'studentNrcPhotoFront',
      studentNrcPhotoBack: 'studentNrcPhotoBack',
      fathNrcPhotoFront: 'fathNrcPhotoFront',
      fathNrcPhotoBack: 'fathNrcPhotoBack',
      mothNrcPhotoFront: 'mothNrcPhotoFront',
      mothNrcPhotoBack: 'mothNrcPhotoBack',
    };

    const dbField = typeMapping[documentType];
    
    if (dbField) {
      (photo as any)[dbField] = filePath;
      await PhotoRepository.save(photo);
      return photo;
    } else {
      throw AppError.badRequest('Invalid document type');
    }
  }

  async submitPayment(
    studentId: number,
    payerName: string,
    transactionCode: string,
    screenshotPath: string
  ): Promise<Payment> {
    // 1. Find the student's semester registration
    const registrationRepo = AppDataSource.getRepository(SemesterRegistration);
    const registration = await registrationRepo.findOne({
      where: { studentId },
      order: { appliedDate: 'DESC' }
    });

    if (!registration) {
      throw AppError.notFound('Semester registration not found. Please complete your profile first.');
    }

    // 2. Create the payment record
    const paymentRepo = AppDataSource.getRepository(Payment);
    
    // Check if a payment already exists for this registration
    let payment = await paymentRepo.findOne({
      where: { registrationId: registration.registrationId }
    });

    if (payment) {
      throw AppError.badRequest('Payment already submitted for this registration.');
    }

    // Check if transaction code is already used
    const existingTx = await paymentRepo.findOne({ where: { transactionCode } });
    if (existingTx) {
      throw AppError.badRequest('This transaction code has already been submitted.');
    }

    payment = paymentRepo.create({
      registrationId: registration.registrationId,
      payerName,
      transactionCode,
      paymentScreenshot: screenshotPath,
      paymentTime: new Date(),
      status: 'pending',
    });

    await paymentRepo.save(payment);

    // 3. Update account status to 'PAYMENT_SUBMITTED'
    const accountRepo = AppDataSource.getRepository(Account);
    await accountRepo.update({ id: studentId }, { applicationStatus: 'PAYMENT_SUBMITTED' });

    return payment;
  }

  async getPayment(studentId: number): Promise<Payment | null> {
    const registrationRepo = AppDataSource.getRepository(SemesterRegistration);
    const registration = await registrationRepo.findOne({
      where: { studentId },
      order: { appliedDate: 'DESC' }
    });

    if (!registration) return null;

    const paymentRepo = AppDataSource.getRepository(Payment);
    return await paymentRepo.findOne({
      where: { registrationId: registration.registrationId }
    });
  }

  async getStudentProfile(studentId: number): Promise<any | null> {
    const studentProfileRepo = AppDataSource.getRepository(StudentProfile);
    const profile = await studentProfileRepo.findOne({
      where: { studentId },
      relations: [
        'parentProfile',
        'addresses',
        'addresses.township',
        'addresses.township.district',
        'addresses.township.district.state',
        'account'
      ],
    });

    if (!profile) return null;

    const parseNrc = (nrc: string | undefined | null) => {
      if (!nrc) return { region: '', city: '', prefix: '', number: '' };
      const match = nrc.match(/^([^\/]+)\/([^\(]+)\(([^\)]+)\)(.+)$/);
      if (match) {
        return {
          region: match[1],
          city: match[2],
          prefix: match[3],
          number: match[4],
        };
      }
      return { region: '', city: '', prefix: '', number: '' };
    };

    const [matriPlaceSelect, matriRollNumber] = profile.highSchoolRollNo
      ? profile.highSchoolRollNo.split('-')
      : ['', ''];

    const reverseGenderMap: Record<string, string> = {
      M: 'ကျား',
      F: 'မ',
    };
    const gender = reverseGenderMap[profile.gender] || 'Other';

    const studentAddress = profile.addresses?.find((a) => a.type === 'current');
    const parentAddress = profile.addresses?.find((a) => a.type === 'parent');

    const mapAddress = (addr: any) => {
      if (!addr) return { state: '', district: '', township: '', address: '' };
      return {
        state: addr.township?.district?.state?.nameMm || '',
        district: addr.township?.district?.nameMm || '',
        township: addr.township?.nameMm || '',
        address: addr.streetAddress || '',
      };
    };

    const dobString = profile.dob
      ? new Date(profile.dob).toISOString().split('T')[0]
      : '';

    return {
      nameMm: profile.nameMm,
      nameEn: profile.nameEn,
      fatherNameMm: profile.parentProfile?.fatherNameMm || '',
      fatherNameEn: profile.parentProfile?.fatherNameEn || '',
      motherNameMm: profile.parentProfile?.motherNameMm || '',
      motherNameEn: profile.parentProfile?.motherNameEn || '',
      studentNrc: parseNrc(profile.studentNrc),
      fatherNrc: parseNrc(profile.parentProfile?.fatherNrc),
      motherNrc: parseNrc(profile.parentProfile?.motherNrc),
      ethnicity: profile.ethnicity || '',
      fatherEthnicity: profile.parentProfile?.fatherEthnicity || '',
      motherEthnicity: profile.parentProfile?.motherEthnicity || '',
      religion: profile.religion || '',
      fatherReligion: profile.parentProfile?.fatherReligion || '',
      motherReligion: profile.parentProfile?.motherReligion || '',
      dob: dobString,
      gender,
      entryAcademicYear: profile.entryAcademicYear || '',
      matriPlaceSelect: matriPlaceSelect || '',
      matriRollNumber: matriRollNumber || '',
      highSchoolName: profile.highSchoolName || '',
      fatherJob: profile.parentProfile?.fatherJob || '',
      motherJob: profile.parentProfile?.motherJob || '',
      parentContact: mapAddress(parentAddress),
      parentPhone: profile.parentProfile?.parentPhone || '',
      studentContact: mapAddress(studentAddress),
      phoneNumber: profile.phoneNumber || '',
      stdEmail: profile.account?.email || '',
    };
  }
}

