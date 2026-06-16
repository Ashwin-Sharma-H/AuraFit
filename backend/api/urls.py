from django.urls import path
from rest_framework.authtoken.views import obtain_auth_token
from .views import (
    RegisterView,
    CurrentUserView,
    PantryItemListCreateView,
    PantryItemDetailView,
    InitEssentialsView,
    MealPlanListCreateView,
    MealPlanDetailView,
    GenerateMealView,
    SavedRecipeListCreateView,
    SavedRecipeDetailView,
    GenerateMealImageView,
    DeleteMealImageView,
    DailyMealBundleListCreateView,
    DailyMealBundleDetailView,
    ApplyDailyMealBundleView,
    AIBundleRecommendView,
    AITargetsCalculateView
)

urlpatterns = [
    # Auth endpoints
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', obtain_auth_token, name='auth_login'),
    path('auth/user/', CurrentUserView.as_view(), name='auth_user'),
    path('auth/calculate-ai-targets/', AITargetsCalculateView.as_view(), name='calculate_ai_targets'),
    
    # Pantry endpoints
    path('pantry/', PantryItemListCreateView.as_view(), name='pantry_list_create'),
    path('pantry/init-essentials/', InitEssentialsView.as_view(), name='pantry_init_essentials'),
    path('pantry/<int:pk>/', PantryItemDetailView.as_view(), name='pantry_detail'),
    
    # Meal Plan endpoints
    path('meals/', MealPlanListCreateView.as_view(), name='meals_list_create'),
    path('meals/<int:pk>/', MealPlanDetailView.as_view(), name='meals_detail'),
    path('meals/generate/', GenerateMealView.as_view(), name='meals_generate'),
    path('meals/generate-image/', GenerateMealImageView.as_view(), name='meals_generate_image'),
    path('meals/delete-image/', DeleteMealImageView.as_view(), name='meals_delete_image'),
    
    # Saved Recipe endpoints
    path('recipes/', SavedRecipeListCreateView.as_view(), name='recipes_list_create'),
    path('recipes/<int:pk>/', SavedRecipeDetailView.as_view(), name='recipes_detail'),
    
    # Meal Bundle endpoints
    path('meal-bundles/', DailyMealBundleListCreateView.as_view(), name='bundle_list_create'),
    path('meal-bundles/ai-recommend/', AIBundleRecommendView.as_view(), name='bundle_ai_recommend'),
    path('meal-bundles/<int:pk>/', DailyMealBundleDetailView.as_view(), name='bundle_detail'),
    path('meal-bundles/<int:pk>/apply/', ApplyDailyMealBundleView.as_view(), name='bundle_apply'),
]

