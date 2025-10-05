"""
Additional API routes for user preferences and AprilTags
"""

from aiohttp import web
import logging

logger = logging.getLogger(__name__)

# In-memory storage for demo (use Azure SQL in production via azure_integration)
user_preferences = {
    "tts_speed": 1.0,
    "announcement_interval": 10,
    "priority_mode": "dynamic",
    "user_id": "default_user"
}

async def handle_get_preferences(request):
    """Get user preferences"""
    try:
        # In production, load from Azure SQL via azure_integration
        return web.json_response(user_preferences)
    except Exception as e:
        logger.error(f"Get preferences error: {e}")
        return web.json_response(
            {"error": str(e)},
            status=500
        )

async def handle_save_preferences(request):
    """Save user preferences"""
    try:
        data = await request.json()
        
        # Update preferences
        user_preferences.update(data)
        
        # In production, save to Azure SQL via azure_integration
        logger.info(f"Preferences updated: {user_preferences}")
        
        return web.json_response({"success": True, "preferences": user_preferences})
    except Exception as e:
        logger.error(f"Save preferences error: {e}")
        return web.json_response(
            {"error": str(e)},
            status=500
        )

def setup_additional_routes(app):
    """Register additional API routes"""
    app.router.add_get('/api/preferences', handle_get_preferences)
    app.router.add_post('/api/preferences', handle_save_preferences)
