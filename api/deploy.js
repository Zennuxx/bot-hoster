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
            
            const decodedContent = Buffer.from(fileContent, 'base64').toString('utf-8');
            const dependencies = detectDependencies(decodedContent);
            const requirementsTxt = generateRequirements(dependencies);
            
            const serviceName = `bot-${Date.now()}`;
            
            // Correct Render API v1 format
            const renderResponse = await fetch('https://api.render.com/v1/services', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RENDER_API_KEY}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    service: {
                        type: 'web_service',
                        name: serviceName,
                        env: 'python',
                        region: 'oregon',
                        plan: 'free',
                        buildCommand: 'pip install -r requirements.txt',
                        startCommand: `python ${fileName}`,
                        envVars: [
                            {
                                key: 'BOT_TOKEN',
                                value: 'YOUR_BOT_TOKEN_HERE'
                            }
                        ],
                        repo: null,
                        autoDeploy: 'no',
                    },
                    files: {
                        [fileName]: decodedContent,
                        'requirements.txt': requirementsTxt,
                    },
                }),
            });
            
            const responseText = await renderResponse.text();
            console.log('Render response:', responseText);
            
            if (!renderResponse.ok) {
                console.error('Render API error:', responseText);
                throw new Error(`Render API error: ${renderResponse.status}`);
            }
            
            const service = JSON.parse(responseText);
            
            return res.status(200).json({
                success: true,
                serviceId: service.id || service.service?.id,
                message: 'Bot deployed successfully!',
            });
            
        } catch (error) {
            console.error('Deploy error:', error);
            return res.status(500).json({
                success: false,
                message: 'Deployment failed: ' + error.message,
            });
        }
    }

    if (req.method === 'DELETE') {
        try {
            const { serviceId } = req.query;
            
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
            return res.status(500).json({
                success: false,
                message: 'Failed to stop bot',
            });
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
}

function detectDependencies(fileContent) {
    const dependencies = new Set();
    
    if (fileContent.includes('telegram') || fileContent.includes('Application')) {
        dependencies.add('python-telegram-bot==20.7');
    }
    if (fileContent.includes('discord')) {
        dependencies.add('discord.py==2.3.2');
    }
    if (fileContent.includes('flask')) {
        dependencies.add('flask==3.0.0');
    }
    if (fileContent.includes('requests')) {
        dependencies.add('requests==2.31.0');
    }
    
    return Array.from(dependencies);
}

function generateRequirements(dependencies) {
    if (dependencies.length === 0) {
        return '# No dependencies detected\n';
    }
    return dependencies.join('\n') + '\n';
}