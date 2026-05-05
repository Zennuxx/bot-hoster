// State management
let hostedBots = JSON.parse(localStorage.getItem('hostedBots') || '[]');
let selectedFile = null;

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
    setupEventListeners();
});

function setupEventListeners() {
    // Upload area click
    uploadArea.addEventListener('click', (e) => {
        if (e.target !== uploadArea.querySelector('button')) {
            fileInput.click();
        }
    });

    // Browse button
    const browseBtn = uploadArea.querySelector('.browse-btn');
    if (browseBtn) {
        browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }

    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    });

    // Drag and drop
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
        if (file) {
            handleFile(file);
        }
    });

    // Host button
    hostBtn.addEventListener('click', deployBot);
}

function handleFile(file) {
    if (!file) return;
    
    if (!file.name.endsWith('.py')) {
        showToast('Please select a Python (.py) file', 'error');
        return;
    }
    
    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    
    // Show file info, hide upload content
    fileInfo.style.display = 'block';
    const uploadContent = uploadArea.querySelector('.upload-content');
    if (uploadContent) {
        uploadContent.style.display = 'none';
    }
    
    hostBtn.disabled = false;
    console.log('File selected:', file.name);
}

function removeFile() {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.style.display = 'none';
    
    const uploadContent = uploadArea.querySelector('.upload-content');
    if (uploadContent) {
        uploadContent.style.display = 'flex';
    }
    
    hostBtn.disabled = true;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function deployBot() {
    if (!selectedFile) return;
    
    showLoading(true, 'Deploying your bot...');
    hostBtn.disabled = true;
    
    try {
        const fileContent = await readFileAsBase64(selectedFile);
        
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
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Deployment failed');
        }
        
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
        showToast(error.message || 'Failed to deploy bot', 'error');
    } finally {
        showLoading(false);
        hostBtn.disabled = false;
    }
}

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

async function stopBot(botId) {
    const bot = hostedBots.find(b => b.id === botId);
    if (!bot) return;
    
    if (!confirm(`Stop hosting ${bot.fileName}?`)) return;
    
    showLoading(true, 'Stopping bot...');
    
    try {
        const response = await fetch(`/api/stop?serviceId=${bot.serviceId}`, {
            method: 'DELETE',
        });
        
        if (!response.ok) {
            throw new Error('Failed to stop bot');
        }
        
        hostedBots = hostedBots.filter(b => b.id !== botId);
        saveBots();
        renderBots();
        
        showToast('Bot stopped successfully', 'success');
        
    } catch (error) {
        console.error('Stop error:', error);
        showToast('Failed to stop bot', 'error');
    } finally {
        showLoading(false);
    }
}

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

function saveBots() {
    localStorage.setItem('hostedBots', JSON.stringify(hostedBots));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(show, text = 'Loading...') {
    if (show) {
        loadingText.textContent = text;
        loadingOverlay.style.display = 'flex';
    } else {
        loadingOverlay.style.display = 'none';
    }
}

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

// Make stopBot available globally for onclick handlers
window.stopBot = stopBot;