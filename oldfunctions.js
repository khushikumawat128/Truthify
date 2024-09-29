// app.post("/predict", async (req, res) => {
//     if (req.isAuthenticated()) {
//       const userId = req.user.user_id;
//       console.log("User ID:", userId);
//       try {
//         const response = await axios.post(
//           "http://127.0.0.1:5000/detect-ingredients",
//           { image_path: "C:/Users/aadit/OneDrive - Shri Vile Parle Kelavani Mandal/Desktop/GenAI/server/image.png", "user_id": userId },
//           { headers: { "Content-Type": "application/json" } }
//         );  
//         console.log(response.data);
//         console.log(response.data.ingredients);
//         console.log(response.status);
//         res.send("Check the server console for results.");
//       } catch (error) {
//         console.error("Failed to make request:", error.message);
//         res.status(500).send("Error occurred");
//       }
//     } else {
//       res.redirect("/login");
//     }
//   });


// # @app.route('/detect-ingredients', methods=['POST'])
// # def detect_ingredients():
// #     if 'image_path' not in request.json:
// #         return jsonify({'error': 'Missing image_path'}), 400

// #     image_path = request.json['image_path']
// #     try:
// #         brand_product = brand_name(image_path, model)
// #         name, category, brand = extract_details(brand_product)
// #         print(f"Extracted Details - Name: {name}, Category: {category}, Brand: {brand}")

// #         ingredients = fetch_ingredients_from_db(name, brand)
// #         if ingredients:
// #             print("Ingredients fetched from database.")
// #             return jsonify({'ingredients': ingredients}), 200

// #         ingredient_image_url = scrape_ingredient_image(name, category, brand)
// #         if ingredient_image_url == "No images available":
// #             print("No ingredient image found.")
// #             return jsonify({'error': 'No ingredient image found'}), 404
        
// #         ingredient_image_path = "downloaded_ingredient_image.jpg"
// #         if not download_image(ingredient_image_url, ingredient_image_path):
// #             return jsonify({'error': 'Failed to download image'}), 500
        
// #         ingredients = ingredient_photo(ingredient_image_path, model , name, category, brand)
// #         if not ingredients:
// #             print("Failed to extract ingredients from image.")
// #             return jsonify({'error': 'Failed to extract ingredients'}), 500
        
// #         print(f"Extracted Ingredients: {ingredients}")

// #         log_ingredients(name, brand, ingredients)
        
// #         return jsonify({'ingredients': ingredients}), 200
// #     except Exception as e:
// #         print(f"Server Error: {e}")
// #         return jsonify({'error': str(e)}), 500

// # @app.route('/detect-ingredients', methods=['POST'])
// # def detect_ingredients():
// #     if 'image_path' not in request.json or 'user_id' not in request.json:
// #         return jsonify({'error': 'Missing image_path or user_id'}), 400
// #     UPLOAD_PATH = 'C:/Users/aadit/OneDrive - Shri Vile Parle Kelavani Mandal/Desktop/GenAI/client'
// #     image_path = request.json['image_path']
// #     user_id = request.json['user_id']
// #     full_path = os.path.join(UPLOAD_PATH, image_path)
// #     try:
// #         brand_product = brand_name(full_path, model)
// #         name, category, brand = extract_details(brand_product)
// #         print(f"Extracted Details - Name: {name}, Category: {category}, Brand: {brand}")

// #         ingredients = fetch_ingredients_from_db(name, brand)
// #         if ingredients:
// #             print("Ingredients fetched from database.")
// #             product_id = get_product_id(name, brand)
// #             log_user_search(user_id, product_id)
// #             return jsonify({
// #                 'product_name': name,
// #                 'product_brand': brand,
// #                 'ingredients': ingredients
// #             }), 200

// #         ingredient_image_url = scrape_ingredient_image(name, category, brand)
// #         if ingredient_image_url == "No images available":
// #             print("No ingredient image found.")
// #             return jsonify({'error': 'No ingredient image found'}), 404
        
// #         ingredient_image_path = "downloaded_ingredient_image.jpg"
// #         if not download_image(ingredient_image_url, ingredient_image_path):
// #             return jsonify({'error': 'Failed to download image'}), 500
        
// #         ingredients = ingredient_photo(ingredient_image_path, model , name, category, brand)
// #         if not ingredients:
// #             print("Failed to extract ingredients from image.")
// #             return jsonify({'error': 'Failed to extract ingredients'}), 500
        
// #         print(f"Extracted Ingredients: {ingredients}")

// #         log_ingredients(name, brand, ingredients)
// #         product_id = get_product_id(name, brand)
// #         log_user_search(user_id, product_id)
        
// #         return jsonify({
// #                 'product_name': name,
// #                 'product_brand': brand,
// #                 'ingredients': ingredients
// #             }), 200
// #     except Exception as e:
// #         print(f"Server Error: {e}")
// #         return jsonify({'error': str(e)}), 500

// # Define the path where uploaded files will be stored




// app.post('/predict', async (req, res) => {
//     if (req.isAuthenticated()) {
//         const userId = req.user.user_id;
//         const claim = req.body.claim;
//         const filePath = req.file ? req.file.path : null;
//         console.log("User ID:", userId);
        
//         try {
//             let ingredients = null;
//             let product_name = "No product name detected";
//             let product_brand = "No product brand detected";
//             let verdict = "No verdict";
//             let why = [];
//             let detailed_analysis = "No analysis available";

//             try {
//                 const response = await axios.post(
//                     "http://127.0.0.1:5000/detect-ingredients",
//                     { image_path: filePath, user_id: userId },
//                     { headers: { "Content-Type": "application/json" } }
//                 );
//                 ingredients = response.data.ingredients || "No ingredients detected";
//                 product_name = response.data.product_name || "No product name detected";
//                 product_brand = response.data.product_brand || "No product brand detected";
//                 const data = await analyzeClaim(claim, ingredients);

//                 console.log("Data:", data);

//                 if (data) {
//                     verdict = data.verdict;
//                     why = data.why;
//                     detailed_analysis = data.detailed_analysis;
//                 }
//             } catch (error) {
//                 console.error("Failed to make request:", error.message);
//                 ingredients = "Error occurred during prediction";
//             }
//             res.render('prediction', { 
//               product_name, 
//               product_brand, 
//               ingredients, 
//               verdict, 
//               why, 
//               detailed_analysis 
//           });
          
//         } catch (error) {
//             console.error("Error fetching previous searches:", error.message);
//             res.status(500).send("Error occurred");
//         }
//     } else {
//         res.redirect("/loginpage");
//     }
// });

// 

