require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const axios = require('axios');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB Atlas');
}).catch(err => {
    console.error('Error connecting to MongoDB:', err);
});

// In-memory state management for users (for bot functionality)
const userStates = {};

// Webhook Verification for Facebook Messenger
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === process.env.VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    } else {
        return res.status(403).send('Verification failed');
    }
});

// Handle Incoming Messages from Facebook Messenger
app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(async (entry) => {
            const webhookEvent = entry.messaging[0];
            const senderId = webhookEvent.sender.id;
            const message = webhookEvent.message?.text || webhookEvent.message?.quick_reply?.payload;

            // Handle user messages
            if (message) {
                await handleMessage(senderId, message);
            }
        });

        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// Function to Send Messages via Facebook Graph API
async function sendMessage(recipientId, messageText, quickReplies = null) {
    const url = `https://graph.facebook.com/v12.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`;
    const data = {
        recipient: { id: recipientId },
        message: { text: messageText },
    };

    if (quickReplies) {
        data.message.quick_replies = quickReplies;
    }

    try {
        await axios.post(url, data);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Function to Fetch Courses from Backend API
async function fetchCourses(filiere, subject, semester) {
    try {
        const response = await axios.get(`${process.env.BACKEND_API_URL}/api/courses/`);
        const courses = response.data;

        // Filter courses by filiere, subject, and semester
        return courses.filter(course => 
            course.filiere === filiere &&
            course.subject === subject &&
            course.semester === semester
        );
    } catch (error) {
        console.error('Error fetching courses:', error);
        return [];
    }
}

// Function to Fetch Subjects for a Given Filière
async function fetchSubjectsForFiliere(filiere) {
    try {
        const response = await axios.get(`${process.env.BACKEND_API_URL}/api/courses/`);
        const courses = response.data;

        // Extract unique subjects for the given filiere
        const subjects = Array.from(new Set(courses
            .filter(course => course.filiere === filiere)
            .map(course => course.subject)));

        return subjects;
    } catch (error) {
        console.error('Error fetching subjects:', error);
        return [];
    }
}

// Handle User Messages (Bot Logic)
async function handleMessage(senderId, message) {
    let responseText = '';

    // Initialize user state if not exists
    if (!userStates[senderId]) {
        userStates[senderId] = { step: 'start' };
    }

    const userState = userStates[senderId];

    // Check if the message is a quick reply payload
    if (message === 'start') {
        userState.step = 'start';
        userStates[senderId] = userState;
        responseText = "👋 مرحباً! أنا بوت المعلم لمساعدتك في الدراسة للبكالوريا 🎓. يمكنني إرسال لك الدروس والفيديوهات 📚🎥.\n\n👇 اختر الفيلير الذي تريد:";
        await sendMessage(senderId, responseText);
        await sendMessage(senderId, 
            "1- Sciences Mathématiques A 🧮\n" +
            "2- Sciences Mathématiques B 🧮\n" +
            "3- Sciences Physiques 🔬\n" +
            "4- Sciences de la Vie et de la Terre (SVT) 🌱"
        );
        return;
    }

    switch (userState.step) {
        case 'start':
            if (message.toLowerCase() === 'hi' || message.toLowerCase() === 'مرحبا') {
                responseText = "👋 مرحباً! أنا بوت المعلم لمساعدتك في الدراسة للبكالوريا 🎓. يمكنني إرسال لك الدروس والفيديوهات 📚🎥.\n\n👇 اختر الفيلير الذي تريد:";
                userState.step = 'select_filiere';
                userStates[senderId] = userState;
                await sendMessage(senderId, responseText);
                await sendMessage(senderId, 
                    "1- Sciences Mathématiques A 🧮\n" +
                    "2- Sciences Mathématiques B 🧮\n" +
                    "3- Sciences Physiques 🔬\n" +
                    "4- Sciences de la Vie et de la Terre (SVT) 🌱"
                );
            } else {
                responseText = "⚠️ لم أفهم رسالتك. يمكنك كتابة 'مرحبا' للبدء من جديد.";
                await sendMessage(senderId, responseText);
            }
            break;

        case 'select_filiere':
            if (['1', '2', '3', '4'].includes(message)) {
                const filieres = [
                    'Sciences Mathématiques A',
                    'Sciences Mathématiques B',
                    'Sciences Physiques',
                    'Sciences de la Vie et de la Terre (SVT)'
                ];
                userState.filiere = filieres[parseInt(message) - 1];
                userState.step = 'select_subject';
                userStates[senderId] = userState;

                // Fetch subjects for the selected filiere
                const subjects = await fetchSubjectsForFiliere(userState.filiere);

                if (subjects.length === 0) {
                    responseText = `⚠️ لا توجد مواد متاحة للفيلير: ${userState.filiere}. الرجاء اختيار فيلير آخر.`;
                    await sendMessage(senderId, responseText, [
                        {
                            content_type: 'text',
                            title: 'العودة للبداية',
                            payload: 'start',
                        },
                    ]);
                    userState.step = 'start';
                    userStates[senderId] = userState;
                    return;
                }

                responseText = `📚 اخترت الفيلير: ${userState.filiere}. الآن اختر المادة:\n` +
                    subjects.map((subject, index) => `${index + 1}- ${subject}`).join('\n');
                await sendMessage(senderId, responseText);
            } else {
                responseText = "⚠️ الرجاء اختيار رقم صحيح. حاول مرة أخرى.";
                await sendMessage(senderId, responseText);
            }
            break;

        case 'select_subject':
            const subjects = await fetchSubjectsForFiliere(userState.filiere);
            if (message >= 1 && message <= subjects.length) {
                userState.subject = subjects[parseInt(message) - 1];
                userState.step = 'select_semester';
                userStates[senderId] = userState;
                responseText = `📖 اخترت المادة: ${userState.subject}. الآن اختر الفصل الدراسي:\n1- الفصل الأول 📅\n2- الفصل الثاني 📅`;
                await sendMessage(senderId, responseText);
            } else {
                responseText = "⚠️ الرجاء اختيار رقم صحيح. حاول مرة أخرى.";
                await sendMessage(senderId, responseText);
            }
            break;

        case 'select_semester':
            if (['1', '2'].includes(message)) {
                userState.semester = parseInt(message);
                userState.step = 'select_material';
                userStates[senderId] = userState;
                responseText = `📖 اخترت الفصل: ${userState.semester === 1 ? 'الأول' : 'الثاني'}. الآن اختر ما تريد:\n1- دروس 📚\n2- فيديوهات 🎥\n3- تمارين 📝`;
                await sendMessage(senderId, responseText);
            } else {
                responseText = "⚠️ الرجاء اختيار رقم صحيح. حاول مرة أخرى.";
                await sendMessage(senderId, responseText);
            }
            break;

        case 'select_material':
            if (['1', '2', '3'].includes(message)) {
                const courses = await fetchCourses(userState.filiere, userState.subject, userState.semester);

                if (courses.length === 0) {
                    responseText = "⚠️ لا توجد مواد متاحة لهذه المادة والفصل. حاول مرة أخرى.";
                    await sendMessage(senderId, responseText, [
                        {
                            content_type: 'text',
                            title: 'العودة للبداية',
                            payload: 'start',
                        },
                    ]);
                    userState.step = 'start';
                    userStates[senderId] = userState;
                    return;
                }

                if (message === '1') {
                    userState.step = 'select_course';
                    userStates[senderId] = userState;
                    responseText = "👇 اختر رقم المادة التي تريدها:\n" + courses.map((course, index) => `${index + 1}- ${course.title}`).join('\n');
                    await sendMessage(senderId, responseText);
                } else if (message === '2') {
                    userState.step = 'select_video';
                    userStates[senderId] = userState;
                    responseText = "👇 اختر رقم الفيديو الذي تريده:\n" + courses.map((course, index) => `${index + 1}- ${course.title}`).join('\n');
                    await sendMessage(senderId, responseText);
                } else if (message === '3') {
                    userState.step = 'select_exercise';
                    userStates[senderId] = userState;
                    responseText = "👇 اختر رقم التمرين الذي تريده:\n" + courses.map((course, index) => `${index + 1}- ${course.title}`).join('\n');
                    await sendMessage(senderId, responseText);
                }
            } else {
                responseText = "⚠️ الرجاء اختيار رقم صحيح. حاول مرة أخرى.";
                await sendMessage(senderId, responseText);
            }
            break;

        case 'select_course':
        case 'select_video':
        case 'select_exercise':
            const courses = await fetchCourses(userState.filiere, userState.subject, userState.semester);
            const selectedCourse = courses[parseInt(message) - 1];

            if (!selectedCourse) {
                responseText = "⚠️ المادة غير موجودة. حاول مرة أخرى.";
                await sendMessage(senderId, responseText);
                return;
            }

            if (userState.step === 'select_course') {
                await sendAttachment(senderId, selectedCourse.pdfUrl, 'file');
                responseText = `📚 تم إرسال ملف ${selectedCourse.title}. هل تريد المزيد من المواد؟\n1- نعم ✅\n2- لا ❌`;
            } else if (userState.step === 'select_video') {
                await sendMessage(senderId, `🎥 شاهد الفيديو هنا: ${selectedCourse.videoUrl}`);
                responseText = `📚 هل تريد المزيد من الفيديوهات؟\n1- نعم ✅\n2- لا ❌`;
            } else if (userState.step === 'select_exercise') {
                await sendAttachment(senderId, selectedCourse.exercisePdfUrl, 'file');
                responseText = `📝 تم إرسال التمرين. هل تريد المزيد من التمارين؟\n1- نعم ✅\n2- لا ❌`;
            }

            userState.step = 'more_courses';
            userStates[senderId] = userState;
            await sendMessage(senderId, responseText);
            break;

        case 'more_courses':
            if (message === '1') {
                userState.step = 'select_material';
                userStates[senderId] = userState;
                responseText = "👇 اختر ما تريد:\n1- دروس 📚\n2- فيديوهات 🎥\n3- تمارين 📝";
                await sendMessage(senderId, responseText);
            } else if (message === '2') {
                userState.step = 'start';
                userStates[senderId] = userState;
                responseText = "👋 شكراً لاستخدامك البوت. يمكنك العودة في أي وقت!";
                await sendMessage(senderId, responseText);
            } else {
                responseText = "⚠️ الرجاء اختيار رقم صحيح. حاول مرة أخرى.";
                await sendMessage(senderId, responseText);
            }
            break;

        default:
            responseText = "⚠️ حدث خطأ غير متوقع. حاول مرة أخرى.";
            await sendMessage(senderId, responseText);
    }
}

// Function to Send Attachments (PDFs or Videos)
async function sendAttachment(recipientId, attachmentUrl, type = 'file') {
    const url = `https://graph.facebook.com/v12.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`;
    const data = {
        recipient: { id: recipientId },
        message: {
            attachment: {
                type: type,
                payload: {
                    url: attachmentUrl,
                },
            },
        },
    };

    try {
        await axios.post(url, data);
    } catch (error) {
        console.error('Error sending attachment:', error);
    }
}

// Apply Routes
app.use('/api/auth', authRoutes); // Authentication routes (register, login)
app.use('/api/courses', courseRoutes); // Course management routes (add, update, delete, fetch)

// Default Route
app.get('/', (req, res) => {
    res.send('Welcome to the Bac Bot API!');
});

// Health Check Route
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Start the Server
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Handle SIGTERM Gracefully (for platforms like Heroku or Docker)
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully.');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});