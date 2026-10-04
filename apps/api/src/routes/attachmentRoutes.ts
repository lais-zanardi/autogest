import { Router } from 'express';
import { AttachmentController } from '../controllers/attachmentController';

const router = Router();

router.post('/upload-url', AttachmentController.getUploadUrl as any);

export default router;
