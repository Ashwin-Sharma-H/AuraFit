from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, PantryItem, MealPlan, SavedRecipe, DailyMealBundle

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            'age', 'height', 'weight', 'activity_level', 'fitness_goal', 'diet_plan', 'allergies',
            'custom_calories', 'custom_protein', 'custom_carbs', 'custom_fat', 'custom_micro_targets'
        ]

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(required=False)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'profile']

    def create(self, validated_data):
        profile_data = validated_data.pop('profile', {})
        password = validated_data.pop('password')
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        
        # Create profile
        UserProfile.objects.create(user=user, **profile_data)
        return user

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        
        # Update User fields
        instance.username = validated_data.get('username', instance.username)
        instance.email = validated_data.get('email', instance.email)
        instance.save()
        
        # Update Profile fields
        profile = instance.profile
        for attr, value in profile_data.items():
            setattr(profile, attr, value)
        profile.save()
        
        return instance

class PantryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PantryItem
        fields = ['id', 'name', 'quantity', 'unit', 'category', 'available', 'date_added']
        read_only_fields = ['id', 'date_added']

    def create(self, validated_data):
        user = self.context['request'].user
        return PantryItem.objects.create(user=user, **validated_data)

class MealPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealPlan
        fields = ['id', 'date', 'meal_type', 'recipe_title', 'recipe_description', 'ingredients_used', 'calories', 'protein', 'carbs', 'fat', 'prepared', 'servings', 'image_data']
        read_only_fields = ['id']

    def create(self, validated_data):
        user = self.context['request'].user
        return MealPlan.objects.create(user=user, **validated_data)

class SavedRecipeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedRecipe
        fields = ['id', 'recipe_title', 'recipe_description', 'ingredients_used', 'calories', 'protein', 'carbs', 'fat', 'servings', 'meal_type', 'image_data', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        user = self.context['request'].user
        return SavedRecipe.objects.create(user=user, **validated_data)


class DailyMealBundleSerializer(serializers.ModelSerializer):
    breakfast_details = SavedRecipeSerializer(source='breakfast', read_only=True)
    lunch_details = SavedRecipeSerializer(source='lunch', read_only=True)
    dinner_details = SavedRecipeSerializer(source='dinner', read_only=True)
    snack_details = SavedRecipeSerializer(source='snack', read_only=True)

    class Meta:
        model = DailyMealBundle
        fields = [
            'id', 'name', 
            'breakfast', 'lunch', 'dinner', 'snack',
            'breakfast_details', 'lunch_details', 'dinner_details', 'snack_details',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        user = self.context['request'].user
        return DailyMealBundle.objects.create(user=user, **validated_data)

