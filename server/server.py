from flask import Flask, request, jsonify
import os
import google.generativeai as genai
from dotenv import load_dotenv
from zenrows import ZenRowsClient
from bs4 import BeautifulSoup
import json
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
import re

load_dotenv()

conn = psycopg2.connect(
    user=os.environ['DB_USER'],
    host=os.environ['DB_HOST'],
    database=os.environ['DB_NAME'],
    password=os.environ['DB_PASSWORD'],
    port=os.environ['DB_PORT']
)

UPLOAD_PATH = r'C:\Users\Admin\Downloads\GenAI\GenAI\client\uploads'

def normalize_name(name):
    name = name.replace('+', ' ').replace('&', 'and')
    return re.sub(r'\s+', ' ', name.strip().replace('.', '').lower())

def log_ingredients(product_name, brand_name, ingredients):
    cursor = conn.cursor()
    product_name_normalized = normalize_name(product_name)
    brand_name_normalized = normalize_name(brand_name)
    cursor.execute("""
        INSERT INTO products (product_name, product_brand, ingredients)
        VALUES (%s, %s, %s)
    """, (product_name_normalized, brand_name_normalized, ingredients))
    conn.commit()
    cursor.close()
    print(f"Logged ingredients for {product_name_normalized} from {brand_name_normalized}.")

def fetch_ingredients_from_db(product_name, brand_name):
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    product_name_normalized = normalize_name(product_name)
    brand_name_normalized = normalize_name(brand_name)
    cursor.execute("""
        SELECT ingredients FROM products
        WHERE product_name = %s AND product_brand = %s
    """, (product_name_normalized, brand_name_normalized))
    result = cursor.fetchone()
    cursor.close()
    return result['ingredients'] if result else None

def check_duplicate_entry(product_name, brand_name):
    cursor = conn.cursor()
    product_name_normalized = normalize_name(product_name)
    brand_name_normalized = normalize_name(brand_name)
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1 FROM products
            WHERE product_name = %s AND product_brand = %s
        )
    """, (product_name_normalized, brand_name_normalized))
    exists = cursor.fetchone()[0]
    cursor.close()
    return exists


def get_product_id(product_name, brand_name):
    cursor = conn.cursor()
    product_name_normalized = normalize_name(product_name)
    brand_name_normalized = normalize_name(brand_name)
    cursor.execute("""
        SELECT product_id FROM products
        WHERE product_name = %s AND product_brand = %s
    """, (product_name_normalized, brand_name_normalized))
    result = cursor.fetchone()
    cursor.close()
    return result[0] if result else None

# def log_user_search(user_id, product_id):
#     cursor = conn.cursor()
#     cursor.execute("""
#         INSERT INTO user_searches (user_id, product_id)
#         VALUES (%s, %s)
#         ON CONFLICT (user_id, product_id) DO NOTHING
#     """, (user_id, product_id))
#     conn.commit()
#     cursor.close()
#     print(f"Logged search for user {user_id} and product {product_id}.")

def log_user_search(user_id, product_id):
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_searches (user_id, product_id)
            VALUES (%s, %s)
            ON CONFLICT (user_id, product_id) DO NOTHING
        """, (user_id, product_id))
        conn.commit()
        print(f"Logged search for user {user_id} and product {product_id}.")
    except Exception as e:
        print(f"Error logging search for user {user_id} and product {product_id}: {e}")
    finally:
        cursor.close()



# Use the descriptive environment variable names
client = ZenRowsClient(os.environ['ZENROWS_KEY'])
genai.configure(api_key=os.environ['API_KEY'])
model = genai.GenerativeModel(model_name="gemini-1.5-flash")

app = Flask(__name__)

def get_product_info(url):
    params = {"js_render": "true", "premium_proxy": "true"}
    response = client.get(url, params=params)
    soup = BeautifulSoup(response.text, 'html.parser')
    return soup

def extract_details(detail):
    desc = detail.strip().split(",")
    name = desc[0].strip().replace(" ", "+")
    category = desc[1].strip().replace(" ", "+")
    brand = desc[2].strip().replace(" ", "+")
    return name, category, brand

def brand_name(image_path, model):
    img_file = genai.upload_file(path=image_path)
    response = model.generate_content([img_file, "Analyze the provided image and identify the product name, brand name and product category of the product shown. Return only the three words separated by singular comma that is the product name, product category and brand name as your response."])
    return response.text

def ingredient_photo(image_path, model,name,category,brand):
    img_file = genai.upload_file(path=image_path)
    prompt = (
    "1. Analyze the provided image to identify any visible ingredients of the food shown.\n"
    "2. If ingredients are visible in the image, extract and return only the ingredients.\n"
    "3. If ingredients are not visible in the image:\n"
    f"    a. Provide a list of common ingredients for the product with the following details:\n"
    f"       - Product Name: {name}\n"
    f"       - Category: {category}\n"
    f"       - Brand: {brand}\n"
    "4. Return only the list of ingredients as your response, with each ingredient separated by a comma."
    )
    response = model.generate_content([img_file, prompt])
    return response.text

def scrape_ingredient_image(name, category, brand):
    search_url = f'https://www.bigbasket.com/ps/?q={name}%2C+{category}%2C+{brand}&nc=as'
    print(f"Searching for: {search_url}")
    soup = get_product_info(search_url)
    x = soup.find_all("h3", {"class": "flex flex-col xl:gap-1 lg:gap-0.5"})
    
    if x:
        endpoint = x[0].find("a").get("href")
        new_url = "https://www.bigbasket.com" + endpoint
        print(f"Found product page: {new_url}")
        soup = get_product_info(new_url)
        data = soup.find("script", {"id": "__NEXT_DATA__"}).text
        json_data = json.loads(data)
        images = json_data['props']['pageProps']['productDetails']['children'][0]['images']
        total_images = len(images)
        if total_images >= 7:
            img_url = images[3]['l']
        elif 3 <= total_images < 7:
            img_url = images[2]['l']
        elif total_images == 2:
            img_url = images[1]['l']
        elif total_images == 1:
            img_url = images[0]['l']
        else:
            img_url = "No images available"
        print(f"Image URL: {img_url}")
        return img_url
    else:
        print("No products found for this search.")
        return "No products found for this search."

def download_image(url, save_path):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    try:
        img_data = requests.get(url, headers=headers)
        img_data.raise_for_status()
        with open(save_path, 'wb') as handler:
            handler.write(img_data.content)
        print(f"Downloaded image from {url} to {save_path}.")
    except requests.RequestException as e:
        print(f"Failed to download image: {e}")
        return False
    return True

@app.route('/detect-ingredients', methods=['POST'])
def detect_ingredients():
    if 'image' not in request.files or 'user_id' not in request.form:
        return jsonify({'error': 'Missing image or user_id'}), 400
    
    user_id = request.form['user_id']
    filename = request.form['filename']
    
    try:
        jpg_image_path = os.path.join(UPLOAD_PATH, filename)
        
        # Use AI to get product details
        brand_product = brand_name(jpg_image_path, model)
        name, category, brand = extract_details(brand_product)
        
        # Check if ingredients are already in the database
        ingredients = fetch_ingredients_from_db(name, brand)
        
        if ingredients is None:  # If not found, generate them using AI
            ingredient_image_url = scrape_ingredient_image(name, category, brand)
            
            if ingredient_image_url == "No images available":
                return jsonify({'error': 'No ingredient image found'}), 404
            
            ingredient_image_path = "downloaded_ingredient_image.jpg"
            download_image(ingredient_image_url, ingredient_image_path)
            
            ingredients = ingredient_photo(ingredient_image_path, model, name, category, brand)
            
            # Log ingredients in the database
            log_ingredients(name, brand, ingredients)
        
        # Log user search
        product_id = get_product_id(name, brand)
        log_user_search(user_id, product_id)

        return jsonify({
            'product_name': normalize_name(name),
            'product_brand': normalize_name(brand),
            'ingredients': ingredients
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)

