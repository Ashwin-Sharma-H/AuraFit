from datetime import date
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import UserProfile, PantryItem, MealPlan, SavedRecipe, DailyMealBundle
from .serializers import (
    UserSerializer, UserProfileSerializer, PantryItemSerializer, 
    MealPlanSerializer, SavedRecipeSerializer, DailyMealBundleSerializer
)
from .gemini_client import GeminiMealPlanner

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]

class CurrentUserView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

class PantryItemListCreateView(generics.ListCreateAPIView):
    serializer_class = PantryItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = PantryItem.objects.filter(user=self.request.user)
        category = self.request.query_params.get('category', None)
        if category:
            queryset = queryset.filter(category=category)
        return queryset

class PantryItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PantryItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PantryItem.objects.filter(user=self.request.user)

# Predefined essentials that get auto-created for new users
ESSENTIAL_ITEMS = [
    {"name": "Salt", "quantity": 1, "unit": "packets"},
    {"name": "Black Pepper", "quantity": 1, "unit": "packets"},
    {"name": "Sugar", "quantity": 1, "unit": "kg"},
    {"name": "Cooking Oil", "quantity": 1, "unit": "bottles"},
    {"name": "Olive Oil", "quantity": 1, "unit": "bottles"},
    {"name": "All-Purpose Flour", "quantity": 1, "unit": "kg"},
    {"name": "Rice", "quantity": 1, "unit": "kg"},
    {"name": "Bread", "quantity": 1, "unit": "packets"},
    {"name": "Eggs", "quantity": 12, "unit": "pcs"},
    {"name": "Butter", "quantity": 1, "unit": "packets"},
    {"name": "Milk", "quantity": 1, "unit": "bottles"},
    {"name": "Garlic", "quantity": 5, "unit": "pcs"},
    {"name": "Onions", "quantity": 1, "unit": "kg"},
    {"name": "Tomatoes", "quantity": 0.5, "unit": "kg"},
    {"name": "Potatoes", "quantity": 1, "unit": "kg"},
    {"name": "Ginger", "quantity": 1, "unit": "pcs"},
    {"name": "Lemon", "quantity": 3, "unit": "pcs"},
    {"name": "Chili Powder", "quantity": 1, "unit": "packets"},
    {"name": "Turmeric", "quantity": 1, "unit": "packets"},
    {"name": "Cumin", "quantity": 1, "unit": "packets"},
    {"name": "Coriander Powder", "quantity": 1, "unit": "packets"},
    {"name": "Soy Sauce", "quantity": 1, "unit": "bottles"},
    {"name": "Vinegar", "quantity": 1, "unit": "bottles"},
    {"name": "Honey", "quantity": 1, "unit": "bottles"},
    {"name": "Baking Powder", "quantity": 1, "unit": "packets"},
    {"name": "Pasta", "quantity": 1, "unit": "packets"},
    {"name": "Oats", "quantity": 1, "unit": "packets"},
    {"name": "Tea", "quantity": 1, "unit": "boxes"},
    {"name": "Coffee", "quantity": 1, "unit": "packets"},
]

class InitEssentialsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        # Check if user already has essentials
        existing = PantryItem.objects.filter(user=user, category='essentials').count()
        if existing > 0:
            # Return existing essentials instead of duplicating
            items = PantryItem.objects.filter(user=user, category='essentials')
            serializer = PantryItemSerializer(items, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # Create all essential items
        created_items = []
        for item_data in ESSENTIAL_ITEMS:
            item = PantryItem.objects.create(
                user=user,
                name=item_data["name"],
                quantity=item_data["quantity"],
                unit=item_data["unit"],
                category='essentials',
                available=True
            )
            created_items.append(item)

        serializer = PantryItemSerializer(created_items, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class MealPlanListCreateView(generics.ListCreateAPIView):
    serializer_class = MealPlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Allow querying by date filter
        queryset = MealPlan.objects.filter(user=self.request.user)
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(date=date_param)
        return queryset

class MealPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MealPlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MealPlan.objects.filter(user=self.request.user)

class GenerateMealView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        meal_type = request.data.get('meal_type', 'lunch').lower()
        if meal_type not in ['breakfast', 'lunch', 'dinner', 'snack']:
            return Response({"error": "Invalid meal type"}, status=status.HTTP_400_BAD_REQUEST)
            
        excluded_items = request.data.get('excluded_items', [])
        preferences = request.data.get('preferences', '')
        servings = request.data.get('servings', 2)

        # Get user profile details
        try:
            profile = user.profile
        except UserProfile.DoesNotExist:
            profile = UserProfile.objects.create(user=user)

        profile_data = {
            "age": profile.age,
            "height": profile.height,
            "weight": profile.weight,
            "activity_level": profile.activity_level,
            "fitness_goal": profile.fitness_goal,
            "diet_plan": profile.diet_plan,
            "allergies": profile.allergies
        }

        # Get only AVAILABLE pantry ingredients for AI generation
        pantry_items = PantryItem.objects.filter(user=user, available=True)
        pantry_names = [f"{item.name} ({item.quantity} {item.unit})" for item in pantry_items]

        # Invoke Gemini Client
        planner = GeminiMealPlanner()
        meal_recommendation = planner.generate_meal(
            user_profile=profile_data,
            pantry_items=pantry_names,
            meal_type=meal_type,
            excluded_items=excluded_items,
            preferences=preferences,
            servings=servings
        )

        return Response(meal_recommendation, status=status.HTTP_200_OK)

from .imagen_client import VertexImagenClient

class SavedRecipeListCreateView(generics.ListCreateAPIView):
    serializer_class = SavedRecipeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = SavedRecipe.objects.filter(user=self.request.user)
        print("\n--- [GET /api/recipes/] ---")
        print(f"Total Saved Recipes: {qs.count()}")
        for r in qs:
            print(f"  ID: {r.id} | Title: '{r.recipe_title}' | Image: '{r.image_data}'")
        print("---------------------------\n")
        return qs

class SavedRecipeDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SavedRecipeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SavedRecipe.objects.filter(user=self.request.user)

import os
import uuid
import base64
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

class GenerateMealImageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        dish_name = request.data.get('dish_name', '')
        ingredients = request.data.get('ingredients', None)
        if not dish_name:
            return Response({"error": "Dish name is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        print(f"[Backend API] Received request to generate image for: '{dish_name}' with ingredients: '{ingredients}'")
        client = VertexImagenClient()
        image_base64 = client.generate_dish_image(dish_name, ingredients=ingredients)
        
        # If it's the fallback SVG, return it directly inline
        if image_base64.startswith("data:image/svg+xml"):
            print("[Backend API] Image generation fell back to SVG. Returning inline SVG.")
            return Response({"image_data": image_base64}, status=status.HTTP_200_OK)
            
        try:
            # Decode the base64 image
            format, imgstr = image_base64.split(';base64,')
            ext = format.split('/')[-1]
            
            # Generate a unique file name
            filename = f"meals/{uuid.uuid4()}.{ext}"
            
            # Ensure the meals directory exists
            meals_dir = os.path.join(settings.MEDIA_ROOT, 'meals')
            os.makedirs(meals_dir, exist_ok=True)
            
            # Save the file to media storage
            data = ContentFile(base64.b64decode(imgstr))
            file_path = default_storage.save(filename, data)
            
            # Generate relative media URL
            image_url = f"{settings.MEDIA_URL}{file_path}"
            print(f"[Backend API] Successfully saved image to disk: {file_path}")
            print(f"[Backend API] Returning local file URL path: {image_url}")
            return Response({"image_data": image_url}, status=status.HTTP_200_OK)
        except Exception as e:
            # Fallback to direct base64 if saving to disk encounters any error
            print(f"[Backend API] Failed to save generated image to disk: {e}")
            return Response({"image_data": image_base64}, status=status.HTTP_200_OK)


class DeleteMealImageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        image_url = request.data.get('image_url', '')
        if not image_url:
            return Response({"error": "Image URL is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        print(f"[Backend API] Received request to delete physical image: '{image_url}'")
        try:
            from .models import delete_physical_image
            delete_physical_image(image_url)
            return Response({"success": True}, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"[Backend API] Failed to delete image: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DailyMealBundleListCreateView(generics.ListCreateAPIView):
    serializer_class = DailyMealBundleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return DailyMealBundle.objects.filter(user=self.request.user)


class DailyMealBundleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DailyMealBundleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return DailyMealBundle.objects.filter(user=self.request.user)


class ApplyDailyMealBundleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            bundle = DailyMealBundle.objects.get(pk=pk, user=request.user)
        except DailyMealBundle.DoesNotExist:
            return Response({"error": "Bundle not found"}, status=status.HTTP_404_NOT_FOUND)

        target_date = request.data.get('date', None)
        if not target_date:
            return Response({"error": "Target date is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Apply the bundle to the target date for the active user.
        slots = [
            ('breakfast', bundle.breakfast),
            ('lunch', bundle.lunch),
            ('dinner', bundle.dinner),
            ('snack', bundle.snack),
        ]
        
        created_meals = []
        for meal_type, recipe in slots:
            if recipe:
                meal_plan, created = MealPlan.objects.update_or_create(
                    user=request.user,
                    date=target_date,
                    meal_type=meal_type,
                    defaults={
                        'recipe_title': recipe.recipe_title,
                        'recipe_description': recipe.recipe_description,
                        'ingredients_used': recipe.ingredients_used,
                        'calories': recipe.calories,
                        'protein': recipe.protein,
                        'carbs': recipe.carbs,
                        'fat': recipe.fat,
                        'servings': recipe.servings,
                        'image_data': recipe.image_data,
                        'prepared': False
                    }
                )
                created_meals.append(meal_plan)

        serializer = MealPlanSerializer(created_meals, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AIBundleRecommendView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        mode = request.data.get('mode', 'auto_fill') # 'auto_fill' or 'generate_new'

        preselected = {
            'breakfast': request.data.get('breakfast_id'),
            'lunch': request.data.get('lunch_id'),
            'dinner': request.data.get('dinner_id'),
            'snack': request.data.get('snack_id'),
        }

        # Resolve any preselected recipe objects belonging to active user
        preselected_recipes = {}
        for slot, r_id in preselected.items():
            if r_id and str(r_id).isdigit():
                try:
                    recipe = SavedRecipe.objects.get(pk=int(r_id), user=user)
                    preselected_recipes[slot] = recipe
                except SavedRecipe.DoesNotExist:
                    pass

        # Fetch/Create Profile
        try:
            profile = user.profile
        except UserProfile.DoesNotExist:
            profile = UserProfile.objects.create(user=user)

        weight = profile.weight or 70.0
        goal = profile.fitness_goal or 'maintain_weight'
        diet = profile.diet_plan or 'balanced'

        # Compute goals (consistent with dashboard & frontend calculations)
        base_cal = 1500 + (weight * 10)
        if goal == 'lose_weight':
            base_cal -= 500
        elif goal == 'gain_muscle':
            base_cal += 400

        p_ratio, c_ratio, f_ratio = 0.25, 0.50, 0.25
        if diet == 'keto':
            p_ratio, c_ratio, f_ratio = 0.20, 0.05, 0.75
        elif diet == 'high_protein':
            p_ratio, c_ratio, f_ratio = 0.35, 0.40, 0.25
        elif diet == 'vegan' or diet == 'vegetarian':
            p_ratio, c_ratio, f_ratio = 0.20, 0.55, 0.25

        goals = {
            "calories": round(base_cal),
            "protein": round((base_cal * p_ratio) / 4),
            "carbs": round((base_cal * c_ratio) / 4),
            "fat": round((base_cal * f_ratio) / 9)
        }

        # Subtract preselected recipes values from goals to get remaining targets
        for slot, recipe in preselected_recipes.items():
            goals['calories'] -= (recipe.calories or 0)
            goals['protein'] -= (recipe.protein or 0)
            goals['carbs'] -= (recipe.carbs or 0)
            goals['fat'] -= (recipe.fat or 0)

        # Clamp remaining goals to positive values
        goals['calories'] = max(0, goals['calories'])
        goals['protein'] = max(0, goals['protein'])
        goals['carbs'] = max(0, goals['carbs'])
        goals['fat'] = max(0, goals['fat'])

        profile_data = {
            "fitness_goal": goal,
            "diet_plan": diet,
            "allergies": profile.allergies or "None",
            "weight": weight,
            "height": profile.height or 170.0
        }

        planner = GeminiMealPlanner()

        if mode == 'auto_fill':
            # Retrieve saved recipes
            recipes = SavedRecipe.objects.filter(user=user)
            recipes_data = [
                {
                    "id": r.id,
                    "recipe_title": r.recipe_title,
                    "meal_type": r.meal_type,
                    "calories": r.calories or 0,
                    "protein": r.protein or 0,
                    "carbs": r.carbs or 0,
                    "fat": r.fat or 0
                } for r in recipes
            ]

            preselected_mapped_ids = {
                slot: recipe.id for slot, recipe in preselected_recipes.items()
            }

            result = planner.recommend_bundle_combination(profile_data, recipes_data, goals, preselected_ids=preselected_mapped_ids)
            return Response(result, status=status.HTTP_200_OK)

        elif mode == 'generate_new':
            # Get only AVAILABLE pantry ingredients for AI generation
            pantry_items = PantryItem.objects.filter(user=user, available=True)
            pantry_names = [f"{item.name} ({item.quantity} {item.unit})" for item in pantry_items]

            # Get existing recipe titles to prevent duplication
            existing_recipes = SavedRecipe.objects.filter(user=user)
            existing_titles = [r.recipe_title for r in existing_recipes]

            slots_to_generate = [slot for slot in ['breakfast', 'lunch', 'dinner', 'snack'] if slot not in preselected_recipes]

            if not slots_to_generate:
                return Response({
                    "breakfast_id": preselected.get("breakfast"),
                    "lunch_id": preselected.get("lunch"),
                    "dinner_id": preselected.get("dinner"),
                    "snack_id": preselected.get("snack"),
                    "explanation": "All slots were already preselected! No recipes generated."
                }, status=status.HTTP_200_OK)

            result = planner.generate_ideal_bundle(
                profile_data, 
                goals, 
                pantry_items=pantry_names,
                existing_recipe_titles=existing_titles,
                slots_to_generate=slots_to_generate
            )
            
            # Save the newly generated recipes into user's SavedRecipe library
            created_ids = {}
            for slot in slots_to_generate:
                r_info = result.get(slot)
                if r_info:
                    recipe = SavedRecipe.objects.create(
                        user=user,
                        recipe_title=r_info.get("recipe_title", f"AI Generated {slot.capitalize()}"),
                        recipe_description=r_info.get("recipe_description", "No instructions provided."),
                        ingredients_used=r_info.get("ingredients_used", ""),
                        calories=r_info.get("calories", 0),
                        protein=r_info.get("protein", 0),
                        carbs=r_info.get("carbs", 0),
                        fat=r_info.get("fat", 0),
                        meal_type=slot,
                        servings=1
                    )
                    created_ids[f"{slot}_id"] = recipe.id
            
            # Prepare result with database IDs so frontend can pre-fill selectors instantly
            response_data = {
                "breakfast_id": created_ids.get("breakfast_id") if 'breakfast' in slots_to_generate else preselected.get("breakfast"),
                "lunch_id": created_ids.get("lunch_id") if 'lunch' in slots_to_generate else preselected.get("lunch"),
                "dinner_id": created_ids.get("dinner_id") if 'dinner' in slots_to_generate else preselected.get("dinner"),
                "snack_id": created_ids.get("snack_id") if 'snack' in slots_to_generate else preselected.get("snack"),
                "explanation": result.get("explanation", "New recipes generated and saved successfully to your library!")
            }
            return Response(response_data, status=status.HTTP_200_OK)

        else:
            return Response({"error": "Invalid recommendation mode"}, status=status.HTTP_400_BAD_REQUEST)

class AITargetsCalculateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        # Allow passing transient values from frontend form or fallback to saved profile
        profile_data = request.data.get('profile', {})
        
        # Load from database if values not passed in payload
        if not profile_data:
            try:
                profile = user.profile
                profile_data = {
                    "age": profile.age,
                    "height": profile.height,
                    "weight": profile.weight,
                    "activity_level": profile.activity_level,
                    "fitness_goal": profile.fitness_goal,
                    "diet_plan": profile.diet_plan,
                    "allergies": profile.allergies
                }
            except UserProfile.DoesNotExist:
                profile_data = {}

        planner = GeminiMealPlanner()
        result = planner.calculate_ai_nutrition_targets(profile_data)
        return Response(result, status=status.HTTP_200_OK)




