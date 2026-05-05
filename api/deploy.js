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
            
            // Auto-detect common dependencies based on file content
            const decodedContent = Buffer.from(fileContent, 'base64').toString('utf-8');
            const dependencies = detectDependencies(decodedContent);
            
            // Auto-generate requirements.txt
            const requirementsTxt = generateRequirements(dependencies);
            
            // Create a new Render service with auto-detected settings
            const serviceName = `bot-${Date.now()}`;
            
            const renderResponse = await fetch('https://api.render.com/v1/services', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RENDER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'web_service',
                    name: serviceName,
                    env: 'python',
                    region: 'oregon',
                    plan: 'free',
                    serviceDetails: {
                        env: 'python',
                        buildCommand: 'pip install -r requirements.txt',
                        startCommand: `python ${fileName}`,
                    },
                    // Create initial files
                    files: {
                        [fileName]: decodedContent,
                        'requirements.txt': requirementsTxt,
                    },
                }),
            });
            
            if (!renderResponse.ok) {
                const error = await renderResponse.json();
                console.error('Render API error:', error);
                throw new Error('Failed to create service');
            }
            
            const service = await renderResponse.json();
            
            // Deploy the service
            await fetch(`https://api.render.com/v1/services/${service.id}/deploys`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RENDER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    clearCache: 'clear',
                }),
            });
            
            return res.status(200).json({
                success: true,
                serviceId: service.id,
                serviceUrl: service.serviceDetails?.url || `https://${serviceName}.onrender.com`,
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
                message: 'Bot stopped and deleted successfully',
            });
            
        } catch (error) {
            console.error('Stop error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to stop bot: ' + error.message,
            });
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
}

// Auto-detect Python dependencies from imports
function detectDependencies(fileContent) {
    const dependencies = new Set();
    
    // Common import patterns
    const importPatterns = [
        { pattern: /import\s+telegram|from\s+telegram/, package: 'python-telegram-bot' },
        { pattern: /import\s+discord|from\s+discord/, package: 'discord.py' },
        { pattern: /import\s+flask|from\s+flask/, package: 'flask' },
        { pattern: /import\s+requests|from\s+requests/, package: 'requests' },
        { pattern: /import\s+numpy|from\s+numpy/, package: 'numpy' },
        { pattern: /import\s+pandas|from\s+pandas/, package: 'pandas' },
        { pattern: /import\s+aiohttp|from\s+aiohttp/, package: 'aiohttp' },
        { pattern: /import\s+bs4|from\s+bs4/, package: 'beautifulsoup4' },
        { pattern: /import\s+dotenv|from\s+dotenv/, package: 'python-dotenv' },
        { pattern: /import\s+pil|from\s+PIL/, package: 'pillow' },
        { pattern: /import\s+openai|from\s+openai/, package: 'openai' },
        { pattern: /import\s+tweepy|from\s+tweepy/, package: 'tweepy' },
        { pattern: /import\s+selenium|from\s+selenium/, package: 'selenium' },
        { pattern: /import\s+fastapi|from\s+fastapi/, package: 'fastapi' },
        { pattern: /import\s+uvicorn|from\s+uvicorn/, package: 'uvicorn' },
        { pattern: /import\s+pymongo|from\s+pymongo/, package: 'pymongo' },
        { pattern: /import\s+psycopg2|from\s+psycopg2/, package: 'psycopg2-binary' },
        { pattern: /import\s+sqlalchemy|from\s+sqlalchemy/, package: 'sqlalchemy' },
        { pattern: /import\s+celery|from\s+celery/, package: 'celery' },
        { pattern: /import\s+redis|from\s+redis/, package: 'redis' },
        { pattern: /import\s+schedule|from\s+schedule/, package: 'schedule' },
        { pattern: /import\s+apscheduler|from\s+apscheduler/, package: 'apscheduler' },
    ];
    
    for (const { pattern, package } of importPatterns) {
        if (pattern.test(fileContent)) {
            dependencies.add(package);
        }
    }
    
    // Always include python-telegram-bot for Telegram bots
    if (fileContent.includes('telegram') && fileContent.includes('Application')) {
        dependencies.add('python-telegram-bot');
    }
    
    return Array.from(dependencies);
}

// Generate requirements.txt from detected dependencies
function generateRequirements(dependencies) {
    if (dependencies.length === 0) {
        return '# No external dependencies detected\n';
    }
    
    return dependencies.map(dep => {
        // Pin specific versions for stability
        const versions = {
            'python-telegram-bot': '20.7',
            'discord.py': '2.3.2',
            'flask': '3.0.0',
            'requests': '2.31.0',
            'numpy': '1.24.3',
            'pandas': '2.1.4',
            'aiohttp': '3.9.1',
            'beautifulsoup4': '4.12.2',
            'python-dotenv': '1.0.0',
            'pillow': '10.1.0',
            'openai': '1.6.1',
            'tweepy': '4.14.0',
            'selenium': '4.16.0',
            'fastapi': '0.105.0',
            'uvicorn': '0.25.0',
            'pymongo': '4.6.1',
            'psycopg2-binary': '2.9.9',
            'sqlalchemy': '2.0.23',
            'celery': '5.3.4',
            'redis': '5.0.1',
            'schedule': '1.2.0',
            'apscheduler': '3.10.4',
        };
        
        const version = versions[dep] || '';
        return version ? `${dep}==${version}` : dep;
    }).join('\n') + '\n';
}
