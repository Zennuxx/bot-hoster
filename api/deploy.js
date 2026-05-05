export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        try {
            const { fileName, fileContent } = req.body;
            
            // Create a new Render service
            const renderResponse = await fetch('https://api.render.com/v1/services', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RENDER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'web_service',
                    name: `bot-${Date.now()}`,
                    env: 'python',
                    region: 'oregon',
                    plan: 'free',
                    repo: null,
                    autoDeploy: 'no',
                    serviceDetails: {
                        env: 'python',
                        buildCommand: 'pip install -r requirements.txt',
                        startCommand: `python ${fileName}`,
                    },
                }),
            });
            
            const service = await renderResponse.json();
            
            // Upload the file (you'll need to handle this based on Render's API)
            // This is a simplified version
            
            return res.status(200).json({
                success: true,
                serviceId: service.id,
                message: 'Bot deployed successfully',
            });
            
        } catch (error) {
            console.error('Deploy error:', error);
            return res.status(500).json({
                success: false,
                message: 'Deployment failed',
            });
        }
    }

    if (req.method === 'DELETE') {
        try {
            const { serviceId } = req.query;
            
            // Delete Render service
            await fetch(`https://api.render.com/v1/services/${serviceId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${process.env.RENDER_API_KEY}`,
                },
            });
            
            return res.status(200).json({
                success: true,
                message: 'Bot stopped successfully',
            });
            
        } catch (error) {
            console.error('Stop error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to stop bot',
            });
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
                      }
