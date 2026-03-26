let contract;
let signer;
let timerInterval;
const contractAddress = "0x3C1f6768dEA64B02bf0c3248fb880eFEAeeCcA57"; 

async function init() {
    if (window.ethereum) {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            window.ethereum.on('accountsChanged', () => location.reload());
            window.ethereum.on('chainChanged', () => location.reload());

            const accounts = await provider.listAccounts();
            if (accounts.length > 0) {
                await setupContract();
                const userAddress = await signer.getAddress();
                await updateAuthUI(userAddress);
            }
        } catch (error) { console.error(error); }
    } else { alert("Vui lòng cài đặt MetaMask!"); }
}

async function setupContract() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    contract = new ethers.Contract(contractAddress, contractABI, signer);
}

async function updateAuthUI(address) {
    const registeredName = await contract.voterNames(address);
    if (registeredName) showDashboard(address, registeredName);
}

async function handleAuth() {
    await setupContract();
    const inputName = document.getElementById("voterNameInput").value;
    if (!inputName) return alert("Nhập tên!");
    const tx = await contract.registerVoter(inputName);
    await tx.wait();
    location.reload();
}

async function showDashboard(address, name) {
    document.getElementById("authSection").style.display = "none";
    document.getElementById("mainDashboard").style.display = "block";

    const adminAddr = await contract.admin();
    const adminBtn = document.getElementById("adminQuickBtn");
    const startBtn = document.getElementById("startElectionBtn"); // Nút Bắt đầu trong Admin Panel

    if (address.toLowerCase() === adminAddr.toLowerCase()) {
        if (adminBtn) adminBtn.style.display = "inline-block";
        if (startBtn) startBtn.style.display = "block";
    }

    document.getElementById("displayName").innerText = `Xin chào: ${name}`;
    loadCandidates();
    runCountdown(); // Kích hoạt đồng hồ
}

async function runCountdown() {
    if (timerInterval) clearInterval(timerInterval);
    
    // Tạo một hàm con để chạy ngay lập tức thay vì đợi 1s
    const updateUI = async () => {
        const timerLabel = document.getElementById("timerDisplay");
        if (!timerLabel) return;

        const statusCard = timerLabel.closest('.election-status-card');

        try {
            const isStarted = await contract.electionStarted();
            if (!isStarted) {
                timerLabel.innerHTML = `<i class="fas fa-pause-circle"></i> Trạng thái: Đang chờ Admin bắt đầu...`;
                return;
            }

            const endTime = await contract.endTime();
            const now = Math.floor(Date.now() / 1000);
            const timeLeft = Number(endTime) - now;

            if (timeLeft > 0) {
                const min = Math.floor(timeLeft / 60);
                const sec = timeLeft % 60;
                timerLabel.innerHTML = `<i class="fas fa-hourglass-half fa-spin"></i> Thời gian còn lại: ${min}ph : ${sec}s`;
                
                if (timeLeft <= 30 && statusCard) {
                    statusCard.style.background = "linear-gradient(135deg, #f1c40f, #f39c12)";
                }
            } else {
                timerLabel.innerHTML = `<i class="fas fa-calendar-check"></i> Cuộc bầu cử đã kết thúc!`;
                if (statusCard) statusCard.style.background = "linear-gradient(135deg, #e74c3c, #c0392b)";
                clearInterval(timerInterval);
            }
        } catch (err) {
            console.error("Lỗi lấy thời gian:", err);
        }
    };

    // Chạy ngay lần đầu tiên
    await updateUI();
    // Sau đó mới chạy lặp lại mỗi giây
    timerInterval = setInterval(updateUI, 1000);
}

async function handleStartElection() {
    const min = prompt("Nhập số phút bầu cử:", "10");
    if (!min) return;
    try {
        const tx = await contract.startElection(min);
        alert("Đang kích hoạt...");
        await tx.wait();
        location.reload();
    } catch (e) { alert(e.reason || e.message); }
}

async function vote(id) {
    try {
        const tx = await contract.vote(id);
        await tx.wait();
        alert("Thành công!");
        loadCandidates();
    } catch (e) { alert(e.reason || "Lỗi: Cuộc bầu cử chưa bắt đầu hoặc đã kết thúc!"); }
}
async function loadCandidates() {
    const listDiv = document.getElementById("candidateList");
    const resultsDiv = document.getElementById("resultsChart");
    if (!listDiv || !resultsDiv) return;

    listDiv.innerHTML = "<p>Đang tải dữ liệu ứng viên...</p>";
    
    try {
        const count = await contract.candidatesCount();
        const totalCandidates = Number(count);
        let totalVotes = 0;
        const candidatesData = [];

        // Lấy dữ liệu từ Blockchain
        for (let i = 1; i <= totalCandidates; i++) {
            const c = await contract.getCandidate(i); 
            if (c[4]) { // Kiểm tra nếu active == true
                totalVotes += Number(c[2]);
                candidatesData.push(c);
            }
        }

        listDiv.innerHTML = "";
        resultsDiv.innerHTML = "";
        
        for (let candidate of candidatesData) {
            const [id, name, votes, imageCID] = candidate;
            const percentage = totalVotes > 0 ? (Number(votes) / totalVotes * 100) : 0;
            
            // Xử lý hiển thị ảnh
            const isBase64 = imageCID && imageCID.startsWith("data:image");
            const avatarHTML = isBase64 
                ? `<img src="${imageCID}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">`
                : `<div style="width:50px; height:50px; border-radius:50%; background:#3498db; color:white; display:flex; align-items:center; justify-content:center;">${name.charAt(0)}</div>`;

            // HTML cho danh sách bầu chọn
            const item = document.createElement("div");
            item.className = "candidate-item";
            item.style = "display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding: 10px; border: 1px solid #eee; border-radius: 8px;";
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    ${avatarHTML}
                    <div><strong>${name}</strong><br><small>ID: #${id}</small></div>
                </div>
                <button onclick="vote(${id})" style="padding: 5px 15px; cursor: pointer; background:#3498db; color:white; border:none; border-radius:4px;">Bầu chọn</button>
            `;
            listDiv.appendChild(item);

            // HTML cho bảng kết quả
            const resultRow = document.createElement("div");
            resultRow.style = "margin-bottom: 10px;";
            resultRow.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span>${name}</span>
                    <span><strong>${votes}</strong> phiếu (${percentage.toFixed(1)}%)</span>
                </div>
                <div style="background: #eee; height: 8px; border-radius: 4px; margin-top: 5px;">
                    <div style="background: #3498db; width: ${percentage}%; height: 100%; border-radius: 4px;"></div>
                </div>`;
            resultsDiv.appendChild(resultRow);
        }
    } catch (err) {
        console.error(err);
        listDiv.innerHTML = "Không thể tải dữ liệu từ Blockchain.";
    }
}
async function addNewCandidate() {
    const name = document.getElementById("candidateNameInput").value;
    const fileInput = document.getElementById("candidateImageInput");
    if (!name) return alert("Nhập tên!");

    if (fileInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            if (base64.length > 5000) return alert("Ảnh quá lớn (>4KB). Vui lòng chọn ảnh nhỏ hơn!");
            await sendCandidateTx(name, base64);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else { await sendCandidateTx(name, ""); }
}

async function sendCandidateTx(name, cid) {
    const tx = await contract.addCandidate(name, cid);
    await tx.wait();
    location.reload();
}

async function deleteCandidate(id) {
    if (!confirm("Xóa ứng viên?")) return;
    const tx = await contract.deleteCandidate(id);
    await tx.wait();
    loadCandidates();
}

// Map windows functions
window.handleAuth = handleAuth;
window.handleStartElection = handleStartElection;
window.vote = vote;
window.addNewCandidate = addNewCandidate;
window.deleteCandidate = deleteCandidate;
window.toggleAdminPanel = () => {
    const p = document.getElementById("adminSection");
    p.style.display = p.style.display === "none" ? "block" : "none";
};

init();