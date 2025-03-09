const express = require('express');
const { addCourse, updateCourse, deleteCourse, getAllCourses } = require('../controllers/courseController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Protected routes for admin
router.post('/', authMiddleware, addCourse);
router.put('/:id', authMiddleware, updateCourse);
router.delete('/:id', authMiddleware, deleteCourse);

// Public route to fetch all courses
router.get('/', getAllCourses); 

module.exports = router;