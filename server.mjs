import express from 'express';
import cors from 'cors';
import db from './db/conn.mjs';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import {v2 as cloudinary} from 'cloudinary';
import multer from  'multer';
          
cloudinary.config({ 
  cloud_name: 'dx53dzhsi', 
  api_key: '365261683399358', 
  api_secret: 'svIa002YmKorEASm_i0y2_qufaU' 
});

const upload = multer({ dest: 'uploads/' });
const app = express();

app.use(express.json());
app.use(cors());


app.use(
    session({
      secret: 'your-secret-key',
      resave: false,
      saveUninitialized: true,
    })
  );
  
  app.use(passport.initialize());
  app.use(passport.session());
  
  const database = db.collection('users');
  
  // Set up Google OAuth strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: '210428474446-7sd68r5p5bnvcphf2bt38ai0v8ql1944.apps.googleusercontent.com',
        clientSecret: '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',
        callbackURL: 'http://localhost:3001/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        // Use the profile information to find or create a user in your database
        // You might need to adjust this based on your database structure
        try {
          let user = await database.findOne({ googleId: profile.id });
  
          if (!user) {
            // Create a new user if not found
            const newUser = {
              name: profile.displayName,
              googleId: profile.id,
              profilePic: profile.photos[0].value,
              threads: [],
              username: '',
              description: '',
            };
            const result = await database.insertOne(newUser);
            if (result.acknowledged) {
              user = newUser;
            }
          }
  
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
  
  // Serialize user to session
  passport.serializeUser((user, done) => {
    done(null, user);
  });
  
  // Deserialize user from session
  passport.deserializeUser((user, done) => {
    done(null, user);
  });
  
  // Route to start Google OAuth
  app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));
  
  // Callback route after successful Google OAuth
// Callback route after successful Google OAuth
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Redirect to the frontend after successful authentication with Google ID
    res.redirect(`http://localhost:3000/home/${req.user.googleId}`);
  }
);


app.get('/', async (req, res) => {
    try {
        const users = await database.find({}).toArray();
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json('internal server error');
    }
});

app.post('/register', async (req, res) => {
  try {
    const { googleId, username, description } = req.body;

    // Find the user by Google ID and update the username and description
    const updatedUser = await database.findOneAndUpdate(
      { googleId },
      { $set: { username, description } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    console.log(updatedUser);
    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});


app.post('/update'  , async (req, res) => {
  try {
    const { name, username, description, googleId } = req.body; // Assuming the request body contains these fields

    // Find the user by Google ID and update the fields
    const updatedUser = await database.findOneAndUpdate(
      { googleId },
      { $set: { name, username, description } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path);

    res.status(200).json({ message: 'Image uploaded successfully', imageUrl: result.secure_url });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/profile/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await database.findOne({ id });
        if (user) {
            res.json('success');
        }
        else {
            res.status('400').json('user not found');
        }
    } catch (error) {
        console.error(error);
        res.status(500).json('internal server error');
    }
});

app.put('/threads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const index = database.threads.findIndex(thread => thread.id === id);

        if (index !== -1) {
            database.threads[index].likes++; // Increment the likes
            res.json(database.threads[index].likes); // Send back the updated likes count
        } else {
            res.status(400).json('Thread not found');
        }
    } catch (error) {
        console.error(error);
        res.status(500).json('Internal server error');
    }
});

app.get('/user/:googleId', async (req, res) => {
  try {
    const { googleId } = req.params;
    const user = await database.findOne({ googleId });

    if (user) {
      res.json(user);
    } else {
      res.status(400).json('user not found');
    }
  } catch (error) {
    console.error(error);
    res.status(500).json('internal server error');
  }
});

app.post('/post', async (req, res) => {
  try {
    const { content, googleId } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Content is required.' });
    }
    const user = await database.findOne({googleId});

    const newPost = {
      id: user.threads.length,
      content: content,
      likes: 0,
    };

    const updatedUser = await database.findOneAndUpdate(
      { googleId },
      { $push: { threads: newPost } },
      { new: true }
    );
    console.log(updatedUser);
    return res.status(201).json({ message: 'Post added successfully', user: user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/reply', async (req, res) => {
  try {
    const { content, googleId, threadId } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Content is required.' });
    }

    const user = await database.findOne({ googleId });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const threadIndex = user.threads.findIndex(thread => thread.id === threadId);

    if (threadIndex === -1) {
      return res.status(404).json({ message: 'Thread not found.' });
    }

    console.log(user.threads)
    
    if (!user.threads[threadIndex].replies) {
      user.threads[threadIndex].replies = [];
    }

    
    const newReply = {
      id: user.threads[threadIndex].replies.length,
      content: content,
      likes: 0,
    };

    if (!user.threads[threadIndex].replies) {
      user.threads[threadIndex].replies = [];
    }

    user.threads[threadIndex].replies.push(newReply);

    const updatedUser = await database.updateOne(
      { googleId },
      {
        $push: {
          'threads.$[thread].replies': newReply
        }
      },
      {
        arrayFilters: [{ 'thread.id': threadId }],
      }
    );
     
    if (updatedUser.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found or thread not found' });
    }
   
    return res.status(201).json({ message: 'Reply added successfully', user: user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});


app.delete('/thread/:username/:threadId', async (req, res) => {
  try {
    const { username, threadId } = req.params;

    // Find the user by username
    const user = await database.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the index of the thread to be deleted in the user's threads array
    const threadIndex = user.threads.findIndex(thread => thread.id === parseInt(threadId));

    if (threadIndex === -1) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    // Remove the thread from the user's threads array
    user.threads.splice(threadIndex, 1);

    // Update the user in the database
    const updatedUser = await database.findOneAndUpdate(
      { username },
      { $set: { threads: user.threads } },
      { new: true }
    );

    return res.status(200).json({ message: 'Thread deleted successfully', user: updatedUser });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/thread/:username/:threadId/:replyId', async (req, res) => {
  try {
    const { username, threadId, replyId } = req.params;

    // Find the user by username
    const user = await database.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the index of the thread to be deleted in the user's threads array
    const threadIndex = user.threads.findIndex(thread => thread.id === parseInt(threadId));

    if (threadIndex === -1) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const updateResult = await database.updateOne(
      { username },
      {
        $pull: {
          'threads.$[thread].replies': { id: parseInt(replyId) }
        }
      },
      {
        arrayFilters: [{ 'thread.id': parseInt(threadId) }],
      }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found or thread not found' });
    }
    
    return res.status(200).json({ message: 'Thread deleted successfully', user: user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});



app.listen(3001, () => {
    console.log('Server is running on port 3001');
});
