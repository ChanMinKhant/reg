import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { AppDataSource } from '../../database/data-source';
import { StudentProfile } from '../../database/entities/StudentProfile';
import { Account } from '../../database/entities/Account';
import { validate } from '../../common/middleware/validate';
import { verifyAuth } from '../../common/middleware/auth.middleware';
import { StudentSchema } from './student.schema';
import { StudentController } from './student.controller';

const router = Router();
const studentController = new StudentController();

// Multer storage configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const studentId = req.params.studentId;
      
      const studentRepo = AppDataSource.getRepository(StudentProfile);
      let student = await studentRepo.findOne({ where: { studentId: Number(studentId) } });
      
      if (!student) {
        // If profile doesn't exist, we find the account and entrance registration to get basic info
        const accountRepo = AppDataSource.getRepository(Account);
        const account = await accountRepo.findOne({
          where: { id: Number(studentId) },
          relations: ['entrance'],
        });
        
        if (!account) {
          return cb(new Error('Student account not found'), '');
        }

        // Create a stub profile. All mandatory fields will be updated during final profile save.
        student = studentRepo.create({
          studentId: Number(studentId),
          nameMm: account.entrance?.applicantNameMm || 'ကျောင်းသားသစ်',
          nameEn: 'Temp',
          gender: 'Other',
          dob: new Date('2000-01-01'),
          phoneNumber: '',
          studentNrc: account.entrance?.nrcNumber || `TEMP/${studentId}`,
          entranceId: account.entranceId || undefined,
        });
        await studentRepo.save(student);
      }

      const dirName = `${studentId}+${student.nameEn}`;
      const uploadPath = path.join(__dirname, '../../../uploads/photos', dirName);

      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      cb(null, uploadPath);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    const documentType = req.params.documentType;
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now();
    const fileName = `${documentType}+${uniqueSuffix}${ext}`;
    cb(null, fileName);
  }
});
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG and WEBP image files are allowed!'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

const paymentStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const uploadPath = path.join(__dirname, '../../../uploads/payments');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `payment+${uniqueSuffix}${ext}`);
  }
});
const uploadPayment = multer({
  storage: paymentStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

router.use(verifyAuth);

/**
 * @route GET /api/students/profile
 * @desc Retrieves the student's saved registration profile details.
 * @access Private (student)
 */
router.get(
  '/profile',
  studentController.getProfile
);

/**
 * @route POST /api/students/profile
 * @desc Saves (upserts) the student's full registration profile submitted from the /dashboard form.
 * @access Private (student)
 */
router.post(
  '/profile',
  validate({ body: StudentSchema.studentProfile }),
  studentController.saveProfile
);

/**
 * @route PATCH /api/students/status
 * @desc Updates the student's registration progress status.
 * @access Private (student)
 */
router.patch(
  '/status',
  validate({ body: StudentSchema.updateStatus }),
  studentController.updateStatus
);

/**
 * @route GET /api/students/payment
 * @desc Retrieves student's payment record if submitted.
 * @access Private (student)
 */
router.get(
  '/payment',
  studentController.getPayment
);

/**
 * @route POST /api/students/payment
 * @desc Submits KBZPay/WavePay payment receipt screenshot and details.
 * @access Private (student)
 */
router.post(
  '/payment',
  uploadPayment.single('receipt'),
  validate({ body: StudentSchema.submitPayment }),
  studentController.submitPayment
);

/**
 * @route GET /api/students/:studentId/photos
 * @desc Retrieves the student's uploaded photo URLs.
 * @access Private (student)
 */
router.get(
  '/:studentId/photos',
  studentController.getPhotos
);

/**
 * @route POST /api/students/:studentId/photos/:documentType
 * @desc Uploads a single photo to the student's photo record.
 * @access Private (student)
 */
router.post(
  '/:studentId/photos/:documentType',
  upload.single('photo'),
  studentController.uploadPhoto
);

export default router;
