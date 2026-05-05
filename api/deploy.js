export default async function handler(req, res) {
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
            
            if (!process.env.RENDER_API_KEY) {
                throw new Error('Render API key not configured');
            }
            
            const decodedContent = Buffer.from(fileContent, 'base64').toString('utf-8');
            const dependencies = detectDependencies(decodedContent);
            const requirementsTxt = generateRequirements(dependencies);
            
            const serviceName = `bot-${Date.now()}`;
            
            // CORRECT Render API v1 format
            const serviceData = {
                type: 'web_service',
                name: serviceName,
                ownerId: 'usr-xxxxxxxx', // We'll get this from the API
                env: 'python',
                region: 'oregon',
                plan: 'starter',
                buildCommand: 'pip install -r requirements.txt',
                startCommand: `python ${fileName}`,
                envVars: [],
                autoDeploy: 'no',
            };
            
            // First, let's try with minimal required fields
            const renderResponse = await fetch('https://api.render.com/v1/services', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RENDER_API_KEY}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(serviceData),
            });
            
            const responseText = await renderResponse.text();
            console.log('Render API Response:', renderResponse.status, responseText);
            
            if (!renderResponse.ok) {
                let errorMessage = 'Render API error';
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessage = errorData.message || errorData.error || responseText;
                } catch (e) {
                    errorMessage = responseText;
                }
                throw new Error(errorMessage);
            }
            
            const service = JSON.parse(responseText);
            const serviceId = service.id;
            
            // Now upload the files using a deploy
            if (serviceId) {
                // Trigger initial deploy with files
                await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.RENDER_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        clearCache: 'clear',
                    }),
                });
            }
            
            return res.status(200).json({
                success: true,
                serviceId: serviceId,
                message: 'Bot deployed successfully! Check Render dashboard.',
            });
            
        } catch (error) {
            console.error('Deploy error:', error.message);
            return res.status(500).json({
                success: false,
                message: error.message || 'Deployment failed',
            });
        }
    }

    if (req.method === 'DELETE') {
        try {
            const { serviceId } = req.query;
            
            const response = await fetch(`https://api.render.com/v1/services/${serviceId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${process.env.RENDER_API_KEY}`,
                },
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete service');
            }
            
            return res.status(200).json({
                success: true,
                message: 'Bot stopped successfully',
            });
            
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
}

function detectDependencies(fileContent) {
    const deps = [];
    if (fileContent.includes('telegram')) deps.push('python-telegram-bot==20.7');
    if (fileContent.includes('discord')) deps.push('discord.py==2.3.2');
    if (fileContent.includes('flask')) deps.push('flask==3.0.0');
    if (fileContent.includes('requests')) deps.push('requests==2.31.0');
    return deps;
}

function generateRequirements(dependencies) {
    if (dependencies.length === 0) return '';
    return dependencies.join('\n') + '\n';
}