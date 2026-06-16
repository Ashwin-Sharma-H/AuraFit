from django.db import models
from django.contrib.auth.models import User
import os
from django.conf import settings

def delete_physical_image(image_path, exclude_recipe_id=None, exclude_meal_id=None):
    if not image_path or not isinstance(image_path, str):
        return

    # Avoid deleting shared files still referenced by other recipes or meal plans
    # Import locally to avoid circular dependencies
    from .models import SavedRecipe, MealPlan

    recipe_qs = SavedRecipe.objects.filter(image_data=image_path)
    if exclude_recipe_id:
        recipe_qs = recipe_qs.exclude(pk=exclude_recipe_id)

    meal_qs = MealPlan.objects.filter(image_data=image_path)
    if exclude_meal_id:
        meal_qs = meal_qs.exclude(pk=exclude_meal_id)

    if recipe_qs.exists() or meal_qs.exists():
        print(f"[Storage] Skipping physical delete of '{image_path}' as it is still referenced by other items.")
        return

    if image_path.startswith(settings.MEDIA_URL):
        rel_path = image_path[len(settings.MEDIA_URL):]
        abs_path = os.path.join(settings.MEDIA_ROOT, rel_path)
        if os.path.exists(abs_path):
            try:
                os.remove(abs_path)
                print(f"[Storage] Deleted physical image: {abs_path}")
            except Exception as e:
                print(f"[Storage] Failed to delete image file {abs_path}: {e}")

class UserProfile(models.Model):
    GOAL_CHOICES = [
        ('lose_weight', 'Lose Weight'),
        ('maintain_weight', 'Maintain Weight'),
        ('gain_muscle', 'Gain Muscle'),
        ('improve_endurance', 'Improve Endurance'),
    ]
    
    DIET_CHOICES = [
        ('balanced', 'Balanced / Anything'),
        ('keto', 'Ketogenic (Low Carb, High Fat)'),
        ('paleo', 'Paleo'),
        ('vegan', 'Vegan'),
        ('vegetarian', 'Vegetarian'),
        ('mediterranean', 'Mediterranean'),
        ('high_protein', 'High Protein'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    age = models.IntegerField(null=True, blank=True)
    height = models.FloatField(help_text="Height in cm", null=True, blank=True)
    weight = models.FloatField(help_text="Weight in kg", null=True, blank=True)
    activity_level = models.CharField(
        max_length=50, 
        choices=[
            ('sedentary', 'Sedentary (Little/no exercise)'),
            ('lightly_active', 'Lightly Active (Light exercise/sports 1-3 days/week)'),
            ('moderately_active', 'Moderately Active (Moderate exercise/sports 3-5 days/week)'),
            ('very_active', 'Very Active (Hard exercise/sports 6-7 days/week)'),
        ],
        default='sedentary'
    )
    fitness_goal = models.CharField(max_length=50, choices=GOAL_CHOICES, default='maintain_weight')
    diet_plan = models.CharField(max_length=50, choices=DIET_CHOICES, default='balanced')
    allergies = models.TextField(help_text="Comma-separated list of allergies or dietary restrictions", blank=True, default='')

    # AI custom nutrition targets
    custom_calories = models.IntegerField(null=True, blank=True)
    custom_protein = models.FloatField(null=True, blank=True)
    custom_carbs = models.FloatField(null=True, blank=True)
    custom_fat = models.FloatField(null=True, blank=True)
    custom_micro_targets = models.TextField(help_text="JSON string of micronutrient targets", blank=True, default="")

    def __str__(self):
        return f"{self.user.username}'s Profile"

class PantryItem(models.Model):
    CATEGORY_CHOICES = [
        ('essentials', 'Essentials'),
        ('fruits', 'Fruits'),
        ('vegetables', 'Vegetables'),
        ('meat_seafood', 'Meat & Seafood'),
        ('dairy', 'Dairy'),
        ('grains_cereals', 'Grains & Cereals'),
        ('spices_condiments', 'Spices & Condiments'),
        ('beverages', 'Beverages'),
        ('snacks', 'Snacks'),
        ('other', 'Other'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pantry_items')
    name = models.CharField(max_length=100)
    quantity = models.FloatField(default=1.0)
    unit = models.CharField(max_length=30, default='pcs', help_text="e.g. g, kg, pcs, cans, cups")
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='other')
    available = models.BooleanField(default=True)
    date_added = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.quantity} {self.unit}) for {self.user.username}"

class MealPlan(models.Model):
    MEAL_TYPE_CHOICES = [
        ('breakfast', 'Breakfast'),
        ('lunch', 'Lunch'),
        ('dinner', 'Dinner'),
        ('snack', 'Snack'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='meal_plans')
    date = models.DateField()
    meal_type = models.CharField(max_length=20, choices=MEAL_TYPE_CHOICES)
    recipe_title = models.CharField(max_length=200)
    recipe_description = models.TextField(help_text="Ingredients, prep steps, etc.", blank=True, default='')
    ingredients_used = models.TextField(help_text="Ingredients used from pantry (JSON/Text)", blank=True, default='')
    calories = models.IntegerField(null=True, blank=True)
    protein = models.FloatField(help_text="Protein in grams", null=True, blank=True)
    carbs = models.FloatField(help_text="Carbohydrates in grams", null=True, blank=True)
    fat = models.FloatField(help_text="Fat in grams", null=True, blank=True)
    prepared = models.BooleanField(default=False)
    servings = models.IntegerField(default=2)
    image_data = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['date', 'meal_type']

    def __str__(self):
        return f"{self.meal_type.capitalize()} for {self.user.username} on {self.date}"

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                old_obj = MealPlan.objects.get(pk=self.pk)
                if old_obj.image_data and old_obj.image_data != self.image_data:
                    delete_physical_image(old_obj.image_data, exclude_meal_id=self.pk)
            except MealPlan.DoesNotExist:
                pass
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.image_data:
            delete_physical_image(self.image_data, exclude_meal_id=self.pk)
        super().delete(*args, **kwargs)

class SavedRecipe(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_recipes')
    recipe_title = models.CharField(max_length=200)
    recipe_description = models.TextField()
    ingredients_used = models.TextField(help_text="Ingredients used from pantry", blank=True, default='')
    calories = models.IntegerField(null=True, blank=True)
    protein = models.FloatField(null=True, blank=True)
    carbs = models.FloatField(null=True, blank=True)
    fat = models.FloatField(null=True, blank=True)
    servings = models.IntegerField(default=2)
    meal_type = models.CharField(max_length=20, default='lunch')
    image_data = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.recipe_title} by {self.user.username}"

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                old_obj = SavedRecipe.objects.get(pk=self.pk)
                if old_obj.image_data and old_obj.image_data != self.image_data:
                    delete_physical_image(old_obj.image_data, exclude_recipe_id=self.pk)
            except SavedRecipe.DoesNotExist:
                pass
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.image_data:
            delete_physical_image(self.image_data, exclude_recipe_id=self.pk)
        super().delete(*args, **kwargs)


class DailyMealBundle(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='daily_bundles')
    name = models.CharField(max_length=150)
    breakfast = models.ForeignKey(SavedRecipe, null=True, blank=True, on_delete=models.SET_NULL, related_name='breakfast_bundles')
    lunch = models.ForeignKey(SavedRecipe, null=True, blank=True, on_delete=models.SET_NULL, related_name='lunch_bundles')
    dinner = models.ForeignKey(SavedRecipe, null=True, blank=True, on_delete=models.SET_NULL, related_name='dinner_bundles')
    snack = models.ForeignKey(SavedRecipe, null=True, blank=True, on_delete=models.SET_NULL, related_name='snack_bundles')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Bundle '{self.name}' by {self.user.username}"

