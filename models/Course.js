const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    filiere: {
        type: String,
        required: true,
        enum: [
            'Sciences Mathématiques A',
            'Sciences Mathématiques B',
            'Sciences Physiques',
            'Sciences de la Vie et de la Terre (SVT)'
        ],
    },
    subject: {
        type: String,
        required: true,
    },
    semester: {
        type: Number,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    pdfUrl: {
        type: String,
    },
    videoUrl: {
        type: String,
    },
    exercisePdfUrl: {
        type: String,
    },
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);