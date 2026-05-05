// State management
let hostedBots = JSON.parse(localStorage.getItem('hostedBots') || '[]');
let selectedFile = null;
let currentDeployId = null;

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const hostBtn = document.getElementById('hostBtn');
const botsList = document.getElementById('botsList');
const botCount = document.getElementById('botCount');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderBots();
});

// File upload handlers
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    handleFile(file);
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFile(file);
});

function handleFile(file) {
    if (!file) return;
    
    if (!file.name.endsWith('.py')) {
        showToast('Please select a Python (.py) file', 'error');
        return;
    }
    
    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.style.display = 'block';
    uploadArea.querySelector('.upload-content').style.display = 'none';
    hostBtn.disabled = false;
}

function removeFile() {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.style.display = 'none';
    uploadArea.querySelector('.upload-content').style.display = 'flex';
    hostBtn.disabled = true;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Host button handler
hostBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    
    showLoading(true, 'Preparing your bot for deployment...');
    
    try {
        const fileContent = await readFileAsBase64(selectedFile);
        
        showLoading(true, 'Deploying to Render...');
        
        // Call our API endpoint
        const response = await fetch('/api/deploy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileName: selectedFile.name,
                fileContent: fileContent,
            }),
        });
        
        if (!response.ok) {
            throw new Error('Deployment failed');
        }
        
        const data = await response.json();
        
        // Add to hosted bots
        const newBot = {
            id: Date.now().toString(),
            fileName: selectedFile.name,
            date: new Date().toISOString().split('T')[0],
            serviceId: data.serviceId,
            status: 'running',
        };
        
        hostedBots.unshift(newBot);
        saveBots();
        renderBots();
        
        removeFile();
        showToast('Bot deployed successfully!', 'success');
        
    } catch (error) {
        console.error('Deployment error:', error);
        showToast('Failed to deploy bot. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
});

// Read file as base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Stop bot handler
async function stopBot(botId) {
    const bot = hostedBots.find(b => b.id === botId);
    if (!bot) return;
    
    showLoading(true, 'Stopping bot...');
    
    try {
        // Call API to stop the service
        await fetch(`/api/stop?serviceId=${bot.serviceId}`, {
            method: 'DELETE',
        });
        
        // Remove from list
        hostedBots = hostedBots.filter(b => b.id !== botId);
        saveBots();
        renderBots();
        
        showToast('Bot stopped successfully', 'success');
        
    } catch (error) {
        console.error('Stop error:', error);
        showToast('Failed to stop bot. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

// Render bots list
function renderBots() {
    botCount.textContent = hostedBots.length;
    
    if (hostedBots.length === 0) {
        botsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No bots hosted yet</p>
                <span>Upload a Python file to get started</span>
            </div>
        `;
        return;
    }
    
    botsList.innerHTML = hostedBots.map(bot => `
        <div class="bot-item">
            <div class="bot-icon">
                <i class="fas fa-robot"></i>
            </div>
            <div class="bot-info">
                <span class="bot-name">${escapeHtml(bot.fileName)}</span>
                <span class="bot-date">${bot.date}</span>
            </div>
            <span class="status-badge status-running">● Running</span>
            <button class="stop-btn" onclick="stopBot('${bot.id}')">
                <i class="fas fa-stop"></i> Stop
            </button>
        </div>
    `).join('');
}

// Save to localStorage
function saveBots() {
    localStorage.setItem('hostedBots', JSON.stringify(hostedBots));
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show loading overlay
function showLoading(show, text = 'Loading...') {
    if (show) {
        loadingText.textContent = text;
        loadingOverlay.style.display = 'flex';
    } else {
        loadingOverlay.style.display = 'none';
    }
}

// Show toast notification
function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    toast.className = 'toast';
    if (type === 'error') {
        toast.classList.add('error');
    }
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}