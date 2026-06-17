import os
import json
import logging
from django.conf import settings
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

class GeminiMealPlanner:
    def __init__(self):
        # 1. Try Vertex AI setup if service account credentials and project are provided
        self.gcp_project = os.getenv("GOOGLE_CLOUD_PROJECT")
        self.gcp_credentials = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        self.gcp_location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.is_configured = False
        self.client = None
        
        if self.gcp_project:
            try:
                if self.gcp_credentials:
                    # Setting GOOGLE_APPLICATION_CREDENTIALS env variable directs google-genai to load the JSON key file
                    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = self.gcp_credentials
                
                # Vertex AI Gemini endpoints are regional; 'global' location is not supported.
                location = self.gcp_location if self.gcp_location and self.gcp_location.lower() != 'global' else 'us-central1'
                
                self.client = genai.Client(
                    vertexai=True,
                    project=self.gcp_project,
                    location=location
                )
                self.is_configured = True
                logger.info(f"Gemini client initialized successfully using Vertex AI (project: {self.gcp_project}, location: {location}).")
            except Exception as e:
                logger.error(f"Failed to configure Vertex AI Client: {e}")
                
        # 2. Fall back to standard Gemini API key if Vertex setup is incomplete
        if not self.is_configured and self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
                self.is_configured = True
                logger.info("Gemini client initialized successfully using standard API Key.")
            except Exception as e:
                logger.error(f"Failed to configure Gemini API Client: {e}")

    def generate_meal(self, user_profile, pantry_items, meal_type, excluded_items=None, preferences="", servings=2):
        """
        Generates a meal recommendation based on:
        - user_profile (dict with age, height, weight, activity_level, fitness_goal, diet_plan, allergies)
        - pantry_items (list of strings representing available groceries)
        - meal_type (breakfast, lunch, dinner, snack)
        - excluded_items (list of ingredient names to explicitly avoid)
        - preferences (string custom requests / cravings)
        - servings (int, number of servings the recipe should yield)
        """
        if excluded_items is None:
            excluded_items = []

        # Filter out any pantry items matching excluded list
        filtered_pantry = []
        for item in pantry_items:
            base_name = item.split('(')[0].strip().lower()
            if not any(excl.strip().lower() == base_name or excl.strip().lower() in base_name for excl in excluded_items):
                filtered_pantry.append(item)

        pantry_list_str = ", ".join(filtered_pantry) if filtered_pantry else "No items (empty pantry)"
        exclusions_str = ", ".join(excluded_items) if excluded_items else "None"
        
        prompt = f"""
        You are an advanced AI Dietician and Fitness Chef.
        Recommend a single healthy recipe for {meal_type} based on the following details.
        
        CRITICAL PANTRY REQUIREMENT:
        You MUST prioritize using the available pantry ingredients list below. The recipe should rely primarily on these pantry ingredients as the main components, and only use basic cooking essentials (like oil, salt, pepper, spices, water, garlic, onions) or minimal outside items if absolutely necessary to complete a healthy meal. Do not invent recipes using main ingredients that are not in the pantry list.
        
        USER FITNESS PROFILE:
        - Fitness Goal: {user_profile.get('fitness_goal', 'maintain_weight')}
        - Diet Plan: {user_profile.get('diet_plan', 'balanced')}
        - Allergies/Restrictions: {user_profile.get('allergies', 'None')}
        - Weight: {user_profile.get('weight', 70)} kg
        - Height: {user_profile.get('height', 170)} cm
        
        AVAILABLE INGREDIENTS IN PANTRY:
        {pantry_list_str}
        
        USER PREFERENCES & CRAVINGS:
        {preferences if preferences else "No custom cravings specified."}
        
        STRICT EXCLUSIONS (Do NOT use these ingredients under any circumstance):
        {exclusions_str}
        
        SERVINGS:
        This recipe must be designed for exactly {servings} serving(s). Scale all ingredient quantities and nutritional values (calories, protein, carbs, fat) accordingly for {servings} serving(s) total.
        
        Provide the output strictly in JSON format matching the schema below.
        
        CRITICAL FORMATTING RULES for "recipe_description":
        You must structure the "recipe_description" text block strictly using standard markdown with the following three headers:
        
        ### Summary
        Provide a 2-3 sentence overview describing the dish, its health benefits, and how it aligns with the user's cravings/preferences.
        
        ### Ingredients
        Use a markdown bullet list (- ) to detail the required ingredients and their exact quantities (including both pantry items and any basic seasonings/water needed).
        
        ### Instructions
        Use a markdown numbered list (1. , 2. , etc.) detailing the step-by-step cooking steps. Do not include raw text or unformatted sentences inside or outside these lists.
        
        JSON Schema:
        {{
            "recipe_title": "Name of the dish",
            "recipe_description": "Structured recipe markdown string matching the rules above",
            "ingredients_used": "Comma-separated list of items from the pantry used in this recipe",
            "calories": 450,
            "protein": 25.5,
            "carbs": 40.0,
            "fat": 15.0
        }}
        """

        if not self.is_configured or not self.client:
            raise Exception("Gemini client is not initialized. Please verify your GEMINI_API_KEY setting in .env.")

        try:
            model_name = getattr(settings, "VERTEX_TEXT_MODEL", "gemini-2.5-flash")
            response = self.client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            
            result_json = json.loads(response.text.strip())
            return result_json
        except Exception as e:
            logger.error(f"Gemini API invocation failed: {e}")
            raise Exception(f"API key quota exceeded or server error. Details: {str(e)}")

    def _generate_mock_meal(self, user_profile, pantry_items, meal_type, excluded_items=None, preferences="", servings=2):
        """
        Returns rich mock data matching the user's diet and goals if API is not active.
        """
        diet = user_profile.get('diet_plan', 'balanced').lower()
        goal = user_profile.get('fitness_goal', 'maintain_weight').lower()
        pref_lower = preferences.lower() if preferences else ""
        
        # Helper lists for mock choices
        pantry_subset = pantry_items[:3] if pantry_items else ["basic pantry staples"]
        pantry_used_str = ", ".join(pantry_subset)

        # Dynamic Mock recipe title and description based on cravings!
        if "chicken" in pref_lower:
            recipe_title = "Pan-Seared Garlic Herb Chicken"
            recipe_description = (
                f"### Summary\n"
                f"A high-protein, flavorful garlic herb chicken dish seared to perfection. "
                f"It perfectly matches your craving for chicken and uses your pantry items.\n\n"
                f"### Ingredients\n"
                f"- 200g Chicken breast (from your pantry)\n"
                f"- 3 cloves Garlic, minced\n"
                f"- 1 tbsp Olive oil\n"
                f"- Salt, pepper, oregano, and garlic powder to taste\n\n"
                f"### Instructions\n"
                f"1. Season chicken breasts with salt, pepper, garlic powder, and oregano.\n"
                f"2. Heat olive oil in a hot skillet and sear the chicken for 6 minutes per side.\n"
                f"3. Sauté and steam the available pantry items ({pantry_used_str}) on the side and serve together."
            )
            calories = 380
            protein = 42.0
            carbs = 8.0
            fat = 12.0
        elif "egg" in pref_lower or "scramble" in pref_lower:
            recipe_title = "Fluffy Pantry Egg Scramble"
            recipe_description = (
                f"### Summary\n"
                f"A quick, fluffy, and nutritious egg scramble utilizing available pantry greens. "
                f"It is high in healthy fats and protein, perfect for satisfying your egg scramble craving.\n\n"
                f"### Ingredients\n"
                f"- 3 Large eggs\n"
                f"- 1 tbsp Butter or olive oil\n"
                f"- Seasonings: salt, black pepper to taste\n"
                f"- Sautéed pantry items ({pantry_used_str})\n\n"
                f"### Instructions\n"
                f"1. Whisk the eggs in a small bowl with a pinch of salt and pepper.\n"
                f"2. Melt butter in a non-stick pan over medium-low heat, toss in the pantry greens ({pantry_used_str}), and sauté for 2 minutes.\n"
                f"3. Pour in the eggs and cook on low heat, folding gently until fluffy and set."
            )
            calories = 290
            protein = 20.0
            carbs = 4.0
            fat = 22.0
        elif "soup" in pref_lower:
            recipe_title = "Hearty Pantry Vegetable Soup"
            recipe_description = (
                f"### Summary\n"
                f"A warm, comforting, and hearty vegetable soup packed with fibers and vitamins. "
                f"It incorporates your pantry staples to create a delicious and satisfying broth.\n\n"
                f"### Ingredients\n"
                f"- 1/2 Onion, diced\n"
                f"- 2 cloves Garlic, minced\n"
                f"- 2 cups Vegetable broth\n"
                f"- Assorted pantry vegetables ({pantry_used_str})\n"
                f"- Salt, pepper, and herbs to taste\n\n"
                f"### Instructions\n"
                f"1. Sauté the diced onions and minced garlic in a soup pot with a splash of water or oil until fragrant.\n"
                f"2. Add the vegetable broth and throw in the available pantry items ({pantry_used_str}).\n"
                f"3. Simmer on medium-low heat for 20 minutes before serving hot."
            )
            calories = 220
            protein = 8.0
            carbs = 38.0
            fat = 4.0
        elif "keto" in diet:
            recipe_title = "Keto Avocado Egg Scramble" if meal_type == "breakfast" else "Grilled Chicken and Broccoli Bowl"
            recipe_description = (
                f"### Summary\n"
                f"A high-fat, low-carb keto-friendly meal designed to keep you in ketosis while feeling full. "
                f"It highlights healthy fats and proteins matching your ketogenic plan.\n\n"
                f"### Ingredients\n"
                f"- 1 Large avocado, sliced\n"
                f"- 150g Protein source (chicken or eggs from pantry: {pantry_used_str})\n"
                f"- 1 tbsp Olive oil\n"
                f"- Salt and pepper to taste\n\n"
                f"### Instructions\n"
                f"1. Heat olive oil in a skillet over medium heat.\n"
                f"2. Sauté your protein source and available pantry ingredients ({pantry_used_str}) until fully cooked.\n"
                f"3. Plate up and serve immediately with sliced avocado on the side."
            )
            calories = 520
            protein = 35.0
            carbs = 6.0
            fat = 38.0
        elif "vegan" in diet or "vegetarian" in diet:
            recipe_title = "Pantry Oatmeal with Berries" if meal_type == "breakfast" else "High-Protein Chickpea & Spinach Sauté"
            recipe_description = (
                f"### Summary\n"
                f"A vibrant, plant-based meal loaded with clean proteins and fibers. "
                f"It is vegan-friendly and perfect for a light, nourishing dish.\n\n"
                f"### Ingredients\n"
                f"- 1 can (200g) Chickpeas, drained and rinsed\n"
                f"- 1 cup Spinach or greens\n"
                f"- 1 clove Garlic, minced\n"
                f"- Pantry additions ({pantry_used_str})\n"
                f"- 1 tsp Lemon juice, cumin, salt, and pepper\n\n"
                f"### Instructions\n"
                f"1. Heat a skillet over medium heat with a splash of water or oil, and sauté the garlic and spinach.\n"
                f"2. Fold in the rinsed chickpeas and pantry additions ({pantry_used_str}).\n"
                f"3. Add the cumin, lemon juice, salt, and pepper, and simmer for 5 minutes."
            )
            calories = 380
            protein = 18.0
            carbs = 50.0
            fat = 10.0
        else:
            # Balanced / High Protein
            if meal_type == "breakfast":
                recipe_title = "Protein Berry Smoothie Bowl"
                recipe_description = (
                    f"### Summary\n"
                    f"A balanced, high-protein berry smoothie bowl to jumpstart your day. "
                    f"It provides a rich dose of antioxidants, protein, and slow-burning carbs.\n\n"
                    f"### Ingredients\n"
                    f"- 1 scoop Protein powder\n"
                    f"- 1 cup Spinach\n"
                    f"- 1/2 cup Frozen berries\n"
                    f"- 1/2 cup Almond milk\n"
                    f"- Oats and almond toppings ({pantry_used_str})\n\n"
                    f"### Instructions\n"
                    f"1. Add protein powder, spinach, berries, and almond milk into a blender. Blend until smooth.\n"
                    f"2. Pour into a bowl and top with oats, almond slices, and any pantry items ({pantry_used_str})."
                )
                calories = 350
                protein = 28.0
                carbs = 42.0
                fat = 7.0
            else:
                recipe_title = "Pan-Seared Lemon Herb Salmon" if goal == "lose_weight" else "Hearty Sweet Potato and Turkey Sauté"
                recipe_description = (
                    f"### Summary\n"
                    f"A premium, balanced protein plate paired with roasted carbs and greens. "
                    f"It helps support muscle recovery and matches your caloric targets.\n\n"
                    f"### Ingredients\n"
                    f"- 150g Salmon fillet or Turkey breast\n"
                    f"- 1 Medium sweet potato, cubed\n"
                    f"- Seasonings: paprika, garlic powder, salt, and pepper\n"
                    f"- Pantry ingredients ({pantry_used_str})\n\n"
                    f"### Instructions\n"
                    f"1. Season salmon or turkey with paprika, garlic powder, salt, and pepper.\n"
                    f"2. Sear in a hot pan for 4-5 minutes per side until cooked through.\n"
                    f"3. Sauté sweet potatoes or greens using your pantry items ({pantry_used_str}) and plate together."
                )
                calories = 420 if goal == "lose_weight" else 650
                protein = 40.0
                carbs = 30.0 if goal == "lose_weight" else 65.0
                fat = 14.0 if goal == "lose_weight" else 22.0

        # Scale nutritional values by servings
        serving_multiplier = servings if servings else 2

        return {
            "recipe_title": recipe_title,
            "recipe_description": recipe_description,
            "ingredients_used": pantry_used_str,
            "calories": int(calories * serving_multiplier),
            "protein": round(protein * serving_multiplier, 1),
            "carbs": round(carbs * serving_multiplier, 1),
            "fat": round(fat * serving_multiplier, 1)
        }

    def recommend_bundle_combination(self, user_profile, saved_recipes, goals, preselected_ids=None):
        """
        Uses Gemini to pick 1 breakfast, 1 lunch, 1 dinner, and 1 snack from the user's
        saved recipes that best sum up to user's daily calorie and macro goals.
        """
        recipes_list_json = json.dumps([
            {
                "id": r.get("id"),
                "recipe_title": r.get("recipe_title"),
                "meal_type": r.get("meal_type", "").lower(),
                "calories": r.get("calories", 0),
                "protein": r.get("protein", 0),
                "carbs": r.get("carbs", 0),
                "fat": r.get("fat", 0)
            } for r in saved_recipes
        ])

        preselected_str = json.dumps(preselected_ids) if preselected_ids else "None"

        prompt = f"""
        You are an elite AI Nutritionist.
        Select exactly one breakfast, one lunch, one dinner, and one snack from the user's SAVED RECIPES list below.
        The selected combination should sum up as close as possible to the USER's DAILY NUTRITIONAL GOALS.

        PRESELECTED RECIPES (You MUST keep these slots exactly as specified and only select for other empty slots):
        {preselected_str}

        USER PROFILE:
        - Fitness Goal: {user_profile.get('fitness_goal', 'maintain_weight')}
        - Diet Plan: {user_profile.get('diet_plan', 'balanced')}
        - Allergies: {user_profile.get('allergies', 'None')}

        DAILY NUTRITIONAL GOALS:
        - Calories: {goals.get('calories', 2000)} kcal
        - Protein: {goals.get('protein', 130)}g
        - Carbs: {goals.get('carbs', 220)}g
        - Fat: {goals.get('fat', 70)}g

        SAVED RECIPES LIST:
        {recipes_list_json}

        DIRECTIONS:
        1. Choose exactly one recipe ID for each slot: "breakfast_id", "lunch_id", "dinner_id", and "snack_id".
        2. For any preselected slot, keep the preselected ID.
        3. If a slot has no recipes available in the SAVED RECIPES LIST, set that field to null.
        4. Explain in the "explanation" field how the selected combination aligns with their fitness goals and macro targets.

        Return strictly in JSON format matching this schema:
        {{
            "breakfast_id": 12, // or null
            "lunch_id": 15, // or null
            "dinner_id": 18, // or null
            "snack_id": 20, // or null
            "explanation": "A sentence explaining the balance..."
        }}
        """

        if not self.is_configured or not self.client:
            logger.info("Gemini API not configured. Using intelligent matching algorithm for mock recommend.")
            return self._mock_recommend_bundle_combination(saved_recipes, goals, preselected_ids=preselected_ids)

        try:
            model_name = getattr(settings, "VERTEX_TEXT_MODEL", "gemini-2.5-flash")
            response = self.client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            return json.loads(response.text.strip())
        except Exception as e:
            logger.error(f"Gemini bundle recommendation failed: {e}. Falling back to mock matching.")
            return self._mock_recommend_bundle_combination(saved_recipes, goals, preselected_ids=preselected_ids)

    def _mock_recommend_bundle_combination(self, saved_recipes, goals, preselected_ids=None):
        # Local heuristic algorithm to find the closest combination of saved recipes matching goals
        breakfasts = [r for r in saved_recipes if r.get("meal_type", "").lower() == "breakfast"]
        lunches = [r for r in saved_recipes if r.get("meal_type", "").lower() == "lunch"]
        dinners = [r for r in saved_recipes if r.get("meal_type", "").lower() == "dinner"]
        snacks = [r for r in saved_recipes if r.get("meal_type", "").lower() == "snack"]

        preselected_ids = preselected_ids or {}
        b_pre = preselected_ids.get("breakfast")
        l_pre = preselected_ids.get("lunch")
        d_pre = preselected_ids.get("dinner")
        s_pre = preselected_ids.get("snack")

        best_combo = {
            "breakfast_id": b_pre,
            "lunch_id": l_pre,
            "dinner_id": d_pre,
            "snack_id": s_pre
        }
        best_diff = float('inf')

        # Run simple nested loops to find combo minimizing calorie diff for unselected slots
        b_opts = [next((x for x in breakfasts if x.get("id") == b_pre), None)] if b_pre else (breakfasts if breakfasts else [None])
        l_opts = [next((x for x in lunches if x.get("id") == l_pre), None)] if l_pre else (lunches if lunches else [None])
        d_opts = [next((x for x in dinners if x.get("id") == d_pre), None)] if d_pre else (dinners if dinners else [None])
        s_opts = [next((x for x in snacks if x.get("id") == s_pre), None)] if s_pre else (snacks if snacks else [None])

        for b in b_opts:
            for l in l_opts:
                for d in d_opts:
                    for s in s_opts:
                        cals = (b.get("calories", 0) if b else 0) + \
                               (l.get("calories", 0) if l else 0) + \
                               (d.get("calories", 0) if d else 0) + \
                               (s.get("calories", 0) if s else 0)
                        diff = abs(cals - goals.get("calories", 2000))
                        if diff < best_diff:
                            best_diff = diff
                            best_combo = {
                                "breakfast_id": b.get("id") if b else None,
                                "lunch_id": l.get("id") if l else None,
                                "dinner_id": d.get("id") if d else None,
                                "snack_id": s.get("id") if s else None,
                            }

        # Construct explanation
        total_cals = 0
        for slot, r_id in best_combo.items():
            if r_id:
                r = next((x for x in saved_recipes if x.get("id") == r_id), None)
                if r:
                    total_cals += r.get("calories", 0)
        best_combo["explanation"] = (
            f"This combination fits your profile target of {goals.get('calories', 2000)} kcal. "
            f"Altogether, it yields {total_cals} kcal. You can adjust the selections to fine-tune your macronutrient balance."
        )
        return best_combo

    def generate_ideal_bundle(self, user_profile, goals, pantry_items=None, existing_recipe_titles=None, slots_to_generate=None):
        """
        Uses Gemini to generate healthy recipe suggestions for specific slots (e.g. breakfast, lunch)
        such that the sum of their nutritional values matches the user's daily fitness goals.
        """
        pantry_str = ", ".join(pantry_items) if pantry_items else "None (Use any standard healthy ingredients)"
        existing_str = ", ".join(existing_recipe_titles) if existing_recipe_titles else "None"
        
        slots_list = slots_to_generate if slots_to_generate else ['breakfast', 'lunch', 'dinner', 'snack']
        slots_desc = "\n".join([f"- exactly 1 {slot} recipe" for slot in slots_list])
        
        # Build dynamic schema based on slots
        schema_props = {}
        for slot in slots_list:
            schema_props[slot] = {
                "recipe_title": f"Title of {slot} recipe",
                "recipe_description": "Markdown instructions",
                "ingredients_used": "comma, separated, ingredients, from, pantry",
                "calories": 500,
                "protein": 35.0,
                "carbs": 50.0,
                "fat": 15.0
            }
        schema_props["explanation"] = "A short sentence highlighting how this daily plan balances their protein and calories."
        schema_json = json.dumps(schema_props, indent=4)

        prompt = f"""
        You are a Michelin-star Health Chef and Dietician.
        Generate a daily meal plan containing:
        {slots_desc}

        The sum of the nutritional values of these generated meals MUST be very close to the user's target goals (which are adjusted to account for any meals they have already selected):
        - Target Calories: {goals.get('calories', 2000)} kcal
        - Target Protein: {goals.get('protein', 130)}g
        - Target Carbs: {goals.get('carbs', 220)}g
        - Target Fat: {goals.get('fat', 70)}g

        USER HEALTH PROFILE:
        - Fitness Goal: {user_profile.get('fitness_goal', 'maintain_weight')}
        - Diet Plan: {user_profile.get('diet_plan', 'balanced')}
        - Allergies/Restrictions: {user_profile.get('allergies', 'None')}

        AVAILABLE PANTRY INGREDIENTS:
        {pantry_str}

        EXISTING RECIPES ALREADY IN RECIPE BOOK (DO NOT DUPLICATE THESE):
        {existing_str}

        CRITICAL REQUIREMENTS:
        1. You MUST prioritize using the available pantry ingredients list above in the generated recipes. The recipes should rely primarily on these pantry ingredients, and only use basic cooking essentials (like oil, salt, spices, water, garlic, onions) or minimal outside items if absolutely necessary to complete a healthy meal. Do not invent recipes using main ingredients that are not in the pantry list.
        2. Do NOT duplicate or use the same title, main ingredients, or description as the existing recipes listed above. The generated recipes must be completely new and unique.
        3. Fill in the "ingredients_used" field for each recipe as a comma-separated list of the actual pantry ingredients used.

        FORMATTING RULE for "recipe_description":
        Inside each recipe, format the description using markdown headers strictly:
        ### Summary
        ### Ingredients
        ### Instructions

        Return strictly in JSON format matching this schema:
        {schema_json}
        """

        if not self.is_configured or not self.client:
            logger.info("Gemini API not configured. Using high-quality mock data for generate_ideal_bundle.")
            return self._mock_generate_ideal_bundle(user_profile, goals, pantry_items=pantry_items, slots_to_generate=slots_list)

        try:
            model_name = getattr(settings, "VERTEX_TEXT_MODEL", "gemini-2.5-flash")
            response = self.client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            return json.loads(response.text.strip())
        except Exception as e:
            logger.error(f"Gemini bundle generation failed: {e}. Falling back to mock data.")
            return self._mock_generate_ideal_bundle(user_profile, goals, pantry_items=pantry_items, slots_to_generate=slots_list)

    def _mock_generate_ideal_bundle(self, user_profile, goals, pantry_items=None, slots_to_generate=None):
        target_cal = goals.get('calories', 2000)
        p = goals.get('protein', 130)
        c = goals.get('carbs', 220)
        f = goals.get('fat', 70)

        slots_list = slots_to_generate if slots_to_generate else ['breakfast', 'lunch', 'dinner', 'snack']

        mock_recipes = {
            "breakfast": {
                "recipe_title": "AI Egg & Avocado Protein Toast",
                "recipe_description": "### Summary\nA nutrient-dense breakfast designed to kickstart your metabolism.\n\n### Ingredients\n- 2 Large Eggs\n- 1/2 Avocado\n- 1 slice Whole wheat bread\n\n### Instructions\n1. Toast the bread.\n2. Mash the avocado with lemon, salt, and pepper and spread on the toast.\n3. Fry or poach eggs and place on top.",
                "ingredients_used": "Eggs, Avocado, Bread",
                "calories": int(target_cal * 0.25) if "breakfast" in slots_list else 400,
                "protein": round(p * 0.25, 1) if "breakfast" in slots_list else 25.0,
                "carbs": round(c * 0.20, 1) if "breakfast" in slots_list else 30.0,
                "fat": round(f * 0.35, 1) if "breakfast" in slots_list else 12.0
            },
            "lunch": {
                "recipe_title": "AI Premium Lemon Garlic Chicken Bowl",
                "recipe_description": "### Summary\nA high-protein clean lunch serving complex carbs and fiber.\n\n### Ingredients\n- 150g Grilled chicken breast\n- 1 cup Brown rice\n- 1 cup Broccoli florets\n- 1 tbsp Olive oil\n\n### Instructions\n1. Sauté broccoli in olive oil.\n2. Grill chicken breast until fully cooked.\n3. Serve together over warm brown rice.",
                "ingredients_used": "Chicken, Brown rice, Broccoli, Olive oil",
                "calories": int(target_cal * 0.35) if "lunch" in slots_list else 600,
                "protein": round(p * 0.35, 1) if "lunch" in slots_list else 40.0,
                "carbs": round(c * 0.40, 1) if "lunch" in slots_list else 65.0,
                "fat": round(f * 0.30, 1) if "lunch" in slots_list else 18.0
            },
            "dinner": {
                "recipe_title": "AI Teriyaki Sesame Salmon Plate",
                "recipe_description": "### Summary\nA recovery dinner loaded with omega-3 fatty acids and clean proteins.\n\n### Ingredients\n- 150g Salmon fillet\n- 1 Sweet potato, cubed\n- Asparagus spears\n\n### Instructions\n1. Roast sweet potato cubes at 200°C for 25 mins.\n2. Sear salmon in a pan for 4 mins each side.\n3. Steam asparagus and serve together.",
                "ingredients_used": "Salmon, Sweet potato, Asparagus",
                "calories": int(target_cal * 0.30) if "dinner" in slots_list else 700,
                "protein": round(p * 0.30, 1) if "dinner" in slots_list else 50.0,
                "carbs": round(c * 0.30, 1) if "dinner" in slots_list else 70.0,
                "fat": round(f * 0.25, 1) if "dinner" in slots_list else 20.0
            },
            "snack": {
                "recipe_title": "AI Almond Butter & Berry Yogurt Bowl",
                "recipe_description": "### Summary\nA light recovery snack packed with active cultures and healthy fats.\n\n### Ingredients\n- 1 cup Greek Yogurt\n- 1 tbsp Almond butter\n- 1/4 cup Mixed berries\n\n### Instructions\n1. Scoop Greek yogurt into a bowl.\n2. Drizzle with almond butter.\n3. Top with fresh berries and serve.",
                "ingredients_used": "Greek Yogurt, Almond butter, Berries",
                "calories": int(target_cal * 0.10) if "snack" in slots_list else 300,
                "protein": round(p * 0.10, 1) if "snack" in slots_list else 15.0,
                "carbs": round(c * 0.10, 1) if "snack" in slots_list else 45.0,
                "fat": round(f * 0.10, 1) if "snack" in slots_list else 10.0
            }
        }

        result = {}
        for slot in slots_list:
            if slot in mock_recipes:
                result[slot] = mock_recipes[slot]

        result["explanation"] = f"This generated daily bundle hits your targets and supplies optimal macros."
        return result

    def calculate_ai_nutrition_targets(self, user_profile):
        """
        Uses Gemini to calculate precise daily Calories, macronutrients (P, C, F),
        micronutrient targets, and dietitian feedback based on all profile settings.
        """
        prompt = f"""
        You are an elite Clinical Sports Dietitian.
        Calculate the precise daily Calorie, Macronutrient (Protein, Carbs, Fat in grams),
        and Micronutrient targets for a user with the following profile:

        USER PROFILE:
        - Age: {user_profile.get('age', 25)} years old
        - Height: {user_profile.get('height', 170)} cm
        - Weight: {user_profile.get('weight', 70)} kg
        - Activity Level: {user_profile.get('activity_level', 'sedentary')}
        - Fitness Goal: {user_profile.get('fitness_goal', 'maintain_weight')}
        - Diet Plan: {user_profile.get('diet_plan', 'balanced')}
        - Allergies/Restrictions: {user_profile.get('allergies', 'None')}

        DIRECTIONS:
        1. Calculate the daily BMR (Basal Metabolic Rate) using the Mifflin-St Jeor equation:
           - Men: BMR = 10 * weight + 6.25 * height - 5 * age + 5
           - Women/Default: BMR = 10 * weight + 6.25 * height - 5 * age - 161
        2. Adjust for TDEE (Total Daily Energy Expenditure) based on Activity Level:
           - sedentary: BMR * 1.2
           - lightly_active: BMR * 1.375
           - moderately_active: BMR * 1.55
           - very_active: BMR * 1.725
        3. Adjust calories for Fitness Goal:
           - lose_weight: Subtract 500 kcal
           - gain_muscle: Add 400 kcal
           - maintain_weight: No change
        4. Distribute macros (Protein, Carbs, Fat) in grams to sum up to the daily calorie target, aligning with their Diet Plan.
        5. Set micronutrient guidelines:
           - Fiber: Target in grams (e.g. "30g")
           - Water: Target in liters (e.g. "3.5L")
           - Sodium: Target in mg (e.g. "2000mg")
           - Potassium: Target in mg (e.g. "3500mg")
        6. Provide a dietitian explanation summarizing BMR, TDEE, and why these macro/micro ratios were recommended.

        Return strictly in JSON format matching this schema:
        {{
            "calories": 2200,
            "protein": 140.0,
            "carbs": 230.0,
            "fat": 75.0,
            "micronutrients": {{
                "Fiber": "30g",
                "Water": "3.5L",
                "Sodium": "2000mg",
                "Potassium": "3500mg"
            }},
            "explanation": "Because you are moderately active..."
        }}
        """

        if not self.is_configured or not self.client:
            logger.info("Gemini API not configured. Using dietitian formula for mock calculate_ai_nutrition_targets.")
            return self._mock_calculate_ai_nutrition_targets(user_profile)

        try:
            model_name = getattr(settings, "VERTEX_TEXT_MODEL", "gemini-2.5-flash")
            response = self.client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            return json.loads(response.text.strip())
        except Exception as e:
            logger.error(f"Gemini calculation failed: {e}. Falling back to mock calculation.")
            return self._mock_calculate_ai_nutrition_targets(user_profile)

    def _mock_calculate_ai_nutrition_targets(self, user_profile):
        age = int(user_profile.get('age') or 25)
        height = float(user_profile.get('height') or 170.0)
        weight = float(user_profile.get('weight') or 70.0)
        activity = user_profile.get('activity_level', 'sedentary')
        goal = user_profile.get('fitness_goal', 'maintain_weight')
        diet = user_profile.get('diet_plan', 'balanced')

        # Standard Mifflin-St Jeor BMR (using female/default constant -161 to be safe)
        bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161
        
        # Activity multipliers
        multipliers = {
            'sedentary': 1.2,
            'lightly_active': 1.375,
            'moderately_active': 1.55,
            'very_active': 1.725
        }
        mult = multipliers.get(activity, 1.2)
        tdee = bmr * mult

        # Adjust for goals
        cal = tdee
        if goal == 'lose_weight':
            cal -= 500
        elif goal == 'gain_muscle':
            cal += 400

        # Enforce reasonable calorie range minimum
        cal = max(1200, round(cal))

        # Macro splits
        p_ratio, c_ratio, f_ratio = 0.25, 0.50, 0.25
        if diet == 'keto':
            p_ratio, c_ratio, f_ratio = 0.20, 0.05, 0.75
        elif diet == 'high_protein':
            p_ratio, c_ratio, f_ratio = 0.35, 0.40, 0.25
        elif diet == 'vegan' or diet == 'vegetarian':
            p_ratio, c_ratio, f_ratio = 0.20, 0.55, 0.25

        p_g = round((cal * p_ratio) / 4, 1)
        c_g = round((cal * c_ratio) / 4, 1)
        f_g = round((cal * f_ratio) / 9, 1)

        # Micros based on profile/diet
        fiber = "35g" if diet in ['vegan', 'vegetarian', 'balanced'] else "25g"
        water = "3.7L" if activity in ['very_active', 'moderately_active'] else "2.8L"
        sodium = "1800mg" if diet == 'mediterranean' else "2300mg"
        potassium = "4700mg" if diet in ['keto', 'high_protein'] else "3500mg"

        explanation = (
            f"Based on your biometrics, your estimated BMR is {round(bmr)} kcal, and your daily TDEE is {round(tdee)} kcal. "
            f"To support your '{goal.replace('_', ' ')}' goal on a '{diet.replace('_', ' ')}' plan, we target {cal} calories. "
            f"Protein is set at {p_g}g to support cell function and muscular integrity."
        )

        return {
            "calories": cal,
            "protein": p_g,
            "carbs": c_g,
            "fat": f_g,
            "micronutrients": {
                "Fiber": fiber,
                "Water": water,
                "Sodium": sodium,
                "Potassium": potassium
            },
            "explanation": explanation
        }


