const Course = require('../models/Course');

exports.addCourse = async (req, res) => {
    try {
        const coursesData = req.body;

        // Check if the input is an array (multiple courses) or a single object (one course)
        if (Array.isArray(coursesData)) {
            // If it's an array, insert many courses
            const courses = await Course.insertMany(coursesData);
            res.status(201).json({ message: 'Courses added successfully', courses });
        } else {
            // If it's a single object, insert one course
            const { filiere, subject, semester, title, pdfUrl, videoUrl, exercisePdfUrl } = coursesData;
            const course = new Course({ filiere, subject, semester, title, pdfUrl, videoUrl, exercisePdfUrl });
            await course.save();
            res.status(201).json({ message: 'Course added successfully', course });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to add course(s)', details: error.message });
    }
};

exports.updateCourse = async (req, res) => {
    try {
        const updatedCourse = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedCourse) {
            return res.status(404).json({ error: 'Course not found' });
        }
        res.json({ message: 'Course updated successfully', course: updatedCourse });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update course' });
    }
};

exports.deleteCourse = async (req, res) => {
    try {
        const deletedCourse = await Course.findByIdAndDelete(req.params.id);
        if (!deletedCourse) {
            return res.status(404).json({ error: 'Course not found' });
        }
        res.json({ message: 'Course deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete course' });
    }
};

exports.getAllCourses = async (req, res) => {
    try {
        const courses = await Course.find();
        res.status(200).json(courses);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
};