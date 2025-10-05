"""
Additional API routes for user preferences and AprilTags
"""

from aiohttp import web
import logging
from azure_integration import AzureSQLService

logger = logging.getLogger(__name__)

# Initialize Azure SQL service
sql_service = AzureSQLService()

async def handle_get_preferences(request):
    """Get user preferences from Azure SQL"""
    try:
        # Get user_id from query params, default to 'default_user'
        user_id = request.query.get('user_id', 'default_user')
        
        # Load from Azure SQL
        prefs = sql_service.get_user_preferences(user_id)
        prefs['user_id'] = user_id
        
        logger.info(f"Loaded preferences for user: {user_id}")
        return web.json_response(prefs)
    except Exception as e:
        logger.error(f"Get preferences error: {e}")
        return web.json_response(
            {"error": str(e)},
            status=500
        )

async def handle_save_preferences(request):
    """Save user preferences to Azure SQL"""
    try:
        data = await request.json()
        
        # Extract user preferences
        user_id = data.get('user_id', 'default_user')
        tts_speed = data.get('tts_speed', 1.0)
        announcement_interval = data.get('announcement_interval', 10)
        priority_mode = data.get('priority_mode', 'dynamic')
        
        # Save to Azure SQL
        sql_service.save_user_preferences(
            user_id=user_id,
            speed=tts_speed,
            interval=announcement_interval,
            mode=priority_mode
        )
        
        logger.info(f"Preferences saved for user: {user_id}")
        
        return web.json_response({
            "success": True, 
            "preferences": {
                "user_id": user_id,
                "tts_speed": tts_speed,
                "announcement_interval": announcement_interval,
                "priority_mode": priority_mode
            }
        })
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
