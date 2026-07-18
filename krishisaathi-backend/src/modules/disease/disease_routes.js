const express = require('express');
const authenticate = require('../../middleware/auth');
const { diseaseUpload } = require('../../middleware/upload');
const handleUploadError = require('../../middleware/upload_error');
const { controller } = require('./DiseaseController');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get('/', controller.list.bind(controller));
router.post('/', diseaseUpload.single('image'), handleUploadError, controller.create.bind(controller));
router.get('/:scan_id', controller.getOne.bind(controller));
router.get('/:scan_id/image', controller.image.bind(controller));

module.exports = router;
