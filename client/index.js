import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { config } from "dotenv";
import multer from 'multer';
import FormData from 'form-data';
import fs from 'fs';
import sharp from "sharp";
import { v4 as uuidv4 } from 'uuid';
import flash from 'connect-flash';
const upload = multer({ dest: 'uploads/' });

const fileName = fileURLToPath(import.meta.url);
const __dirname = path.dirname(fileName);



const dotenvDirName = path.dirname(fileName);
const dotenvPath = path.join(dotenvDirName, "../.env");
config({ path: dotenvPath });

const app = express();
const port = 3000;
const saltRounds = 10;
app.set("view engine", "ejs");

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('views'));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

// Now use __dirname to set the views directory
app.set("views", path.join(__dirname, "../client/views"));

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
db.connect();

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/loginpage", (req, res) => {
  res.render("loginpage.ejs");
});

app.post(
"/loginpage",
passport.authenticate("local", {
  successRedirect: "/homepage",
  failureRedirect: "/loginpage",
  failureFlash: true
})
);
passport.use(
  new LocalStrategy(
    { usernameField: "email" }, // 'email' field matches your login form
    async (email, password, done) => {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length > 0) {
          const user = result.rows[0];
          const validPassword = await bcrypt.compare(password, user.password_hash);
          if (validPassword) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Incorrect password" });
          }
        } else {
          return done(null, false, { message: "User not found" });
        }
      } catch (err) {
        console.error("Error during authentication:", err);
        return done(err);
      }
    }
  )
);

// passport.use(
//   new LocalStrategy(
//     { usernameField: "email" },
//     async (email, password, done) => {
//       try {
//         const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
//         if (result.rows.length > 0) {
//           const user = result.rows[0];
//           const storedHashedPassword = user.password_hash;
//           bcrypt.compare(password, storedHashedPassword, (err, valid) => {
//             if (err) return done(err);
//             if (valid) return done(null, user);
//             else return done(null, false, { message: "Incorrect password" });
//           });
//         } else {
//           return done(null, false, { message: "User not found" });
//         }
//       } catch (err) {
//         return done(err);
//       }
//     }
//   )
// );

passport.serializeUser((user, done) => {
  done(null, user.user_id); 
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE user_id = $1", [id]);
    if (result.rows.length > 0) {
      done(null, result.rows[0]);
    } else {
      done(new Error("User not found"));
    }
  } catch (err) {
    done(err);
  }
});

app.get('/homepage', async (req, res) => {
  if (!req.isAuthenticated()) {
    console.log("User is not authenticated, redirecting to login.");
    return res.redirect('/loginpage');
  }

  try {
    // Log the user ID to ensure it's being passed correctly
    console.log("Authenticated user ID:", req.user.user_id);

    // Fetch previous searches
    const searches = await previousSearches(req.user.user_id);

    // Log the fetched searches to ensure they are retrieved correctly
    console.log("Previous searches:", searches);

    // Render the homepage with the searches data
    res.render('homepage', { searches });
  } catch (err) {
    console.error("Error occurred while fetching searches or rendering page:", err);
    return res.status(500).send("Error occurred while loading the homepage.");
  }
});

// app.get('/homepage', async (req, res) => {
//   if (!req.user.user_id) {
//     return res.redirect('/loginpage');
//   }
//   try {
//     const searches = await previousSearches(req.user.user_id);
//     res.render('homepage', { searches });
//   } catch (err) {
//     console.error("Error fetching previous searches:", err);
//     res.status(500).send("Error occurred");
//   }
// });


const previousSearches = async (user_id) => {
  try {
      const query = `
          SELECT p.product_name, p.product_brand, p.ingredients
          FROM user_searches s
          JOIN products p ON s.product_id = p.product_id
          WHERE s.user_id = $1
          ORDER BY s.search_timestamp DESC
          LIMIT 3
      `;
      const result = await db.query(query, [user_id]);
      if (result.rows.length === 0) {
          return [];
      }
      return result.rows;
  } catch (err) {
      console.error("Error fetching user searches:", err);
      throw err;
  }
};

app.get('/homepage', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/loginpage');
  }

  try {
    const searches = await previousSearches(req.user.user_id);
    res.render('homepage', { searches });
  } catch (err) {
    console.error("Detailed Error:", err);  // Log the exact error
    return res.status(500).send("Error occurred while loading the homepage.");
  }
});

app.get('/homepage', (req, res) => {
  if (!req.isAuthenticated()) {
    console.log("User is not authenticated");
    return res.redirect('/loginpage');
  } else {
    console.log("User is authenticated");
    res.render('homepage');
  }
});

db.query("SELECT 1", (err, res) => {
  if (err) {
    console.error("Database connection error:", err);
  } else {
    console.log("Database connected successfully.");
  }
});

app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (checkResult.rows.length > 0) {
      res.redirect("/loginpage");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
          res.status(500).send("Internal server error");
        } else {
          const result = await db.query(
            "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
            [username, email, hash]
          );

          req.login(result.rows[0], (err) => {
            if (err) {
              console.error("Error logging in after registration:", err);
              return res.status(500).send("Login after registration failed");
            }
            console.log("User ID after registration and login:", result.rows[0].user_id);
            res.redirect("/homepage");
          });
        }
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

  
app.get('/product/:id', async (req, res) => {
  if (req.isAuthenticated()) {
      const productId = req.params.id;
      try {
          const query = 'SELECT * FROM products WHERE product_id = $1';
          const values = [productId];
          
          const result = await db.query(query, values);

          if (result.rows.length === 0) {
              res.status(404).send('Product not found.');
              return;
          }
          const product = result.rows[0];
          res.render('productDetails', { product });
      } catch (error) {
          console.error("Error fetching product details:", error.message);
          res.status(500).send("Error occurred while fetching product details.");
      }
  } else {
      res.redirect("/login");
  }
});

app.post('/predict', upload.single('image'), async (req, res) => {
  if (req.isAuthenticated()) {
    const userId = req.user.user_id;
    const claim = req.body.claim;
    const file = req.file;
    const ingredientsInput = req.body.ingredients;
    console.log("User ID:", userId);
    try {
      if (!file && !ingredientsInput) {
        console.error("No file or ingredients provided");
        return res.status(400).send("Please provide either an image or ingredients");
      }
      let ingredients = ingredientsInput || null;
      let product_name = "No product name detected";
      let product_brand = "No product brand detected";
      let verdict = "No verdict";
      let why = [];
      let detailed_analysis = "No analysis available";
      if (!ingredientsInput && file) {
        const uniqueFilename = uuidv4() + '.jpg';
        const jpegImagePath = path.join(dotenvDirName, 'uploads', uniqueFilename);
        await saveImageAsJPEG(file.path, jpegImagePath);
        try {
          const form = new FormData();
          form.append('image', fs.createReadStream(jpegImagePath));
          form.append('user_id', userId);
          form.append('filename', uniqueFilename);
          const response = await axios.post(
            "http://127.0.0.1:5000/detect-ingredients",
            form,
            {
              headers: {
                ...form.getHeaders(),
              },
            }
          );
          ingredients = response.data.ingredients || "No ingredients detected";
          product_name = response.data.product_name || "No product name detected";
          product_brand = response.data.product_brand || "No product brand detected";
        } catch (error) {
          console.error("Failed to make request:", error.message);
          ingredients = "Error occurred during prediction";
        }
      }
      console.log("Ingredients:", ingredients);
      const data = await analyzeClaim(claim, ingredients);
      console.log("Data:", data);
      if (data) {
        verdict = data.verdict;
        why = data.why;
        detailed_analysis = data.detailed_analysis;
      }
      res.render('prediction', { 
        product_name, 
        product_brand, 
        ingredients, 
        verdict, 
        why, 
        detailed_analysis 
      });
    } catch (error) {
      console.error("Error occurred:", error.message);
      res.status(500).send("Error occurred");
    }
  } else {
    res.redirect("/loginpage");
  }
});


app.post('/search', async (req, res) => {
  if (req.isAuthenticated()) {
      const productName = req.body.product_name;
      const userId = req.user.user_id;

      try {
        const query = `
        SELECT * FROM products
        WHERE LOWER(product_name) LIKE LOWER($1)
        OR LOWER(product_brand) LIKE LOWER($1);
        `;
        const values = [`%${searchTerm}%`];
        const result = await db.query(query, values);
        if (result.rows.length === 0) {
              res.render('searchResults', { products: [], message: 'No products found.', userId });
              return;
        }
        const products = result.rows;
        res.render('searchResults', { products, message: null, userId });
      } catch (error) {
          console.error("Error searching for products:", error.message);
          res.status(500).send("Error occurred during the search.");
      }
  } else {
      res.redirect("/login");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

const analyzeClaim = async (claim, ingredients) => {
    try {
        const response = await axios.get('https://cwbackend-a3332a655e1f.herokuapp.com/claims/analyze', {
            params: {
                claim: claim,
                ingredients: ingredients
            }
        });
        const data = JSON.parse(response.data);
        console.log(data);
        return data;
    } catch (error) {
        console.error('Error making request:', error.message);
        throw error;
    }
};
async function saveImageAsJPEG(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .jpeg()
      .toFile(outputPath);
    console.log(`Image saved as JPEG at: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error saving image as JPEG:', error);
    throw error;
  }
}
app.get('/contact', (req, res) => {
  res.render('contact'); // This renders the contact.ejs page
});
app.use(express.urlencoded({ extended: true }));

app.post('/send-message', (req, res) => {
  const { name, email, message } = req.body;

  const query = `INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3)`;
  
  db.query(query, [name, email, message], (error, result) => {
      if (error) {
          console.error('Error storing message: ', error);
          return res.status(500).send('Error storing your message. Please try again later.');
      }
      res.redirect('/contact');
  });
});
