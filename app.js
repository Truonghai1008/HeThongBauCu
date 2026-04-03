let contract;
let signer;
let timerInterval;
const contractAddress = "0x856e9F5aC3781807627FA6fA149fC99E1706341c"; 

async function init() {
    if (window.ethereum) {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            
            // Lắng nghe sự kiện đổi tài khoản
            window.ethereum.on('accountsChanged', () => location.reload());
            window.ethereum.on('chainChanged', () => location.reload());

            const accounts = await provider.listAccounts();
            if (accounts.length > 0) {
                await setupContract();
                const userAddress = await signer.getAddress();
                await updateAuthUI(userAddress);
            }
        } catch (error) { console.error("Lỗi khởi tạo:", error); }
    } else { alert("Vui lòng cài đặt MetaMask!"); }
}

async function setupContract() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    contract = new ethers.Contract(contractAddress, contractABI, signer);
}

async function updateAuthUI(address) {
    try {
        const registeredName = await contract.voterNames(address);
        if (registeredName && registeredName.trim() !== "") {
            showDashboard(address, registeredName);
        }
    } catch (e) { console.error("Lỗi kiểm tra danh tính:", e); }
}

async function handleAuth() {
    await setupContract();
    const inputName = document.getElementById("voterNameInput").value;
    if (!inputName) return alert("Vui lòng nhập tên!");
    try {
        const tx = await contract.registerVoter(inputName);
        alert("Đang đăng ký tên lên Blockchain...");
        await tx.wait();
        location.reload();
    } catch (e) { alert("Lỗi đăng ký: " + (e.reason || e.message)); }
}

async function showDashboard(address, name) {
    document.getElementById("authSection").style.display = "none";
    document.getElementById("mainDashboard").style.display = "block";

    const adminAddr = await contract.admin();
    const adminBtn = document.getElementById("adminQuickBtn");
    const startBtn = document.getElementById("startElectionBtn");
    const stopBtn = document.getElementById("stopElectionBtn");
    const roleLabel = document.getElementById("userRole"); 

    const isAdmin = address.toLowerCase() === adminAddr.toLowerCase();

    if (roleLabel) {
        roleLabel.innerText = isAdmin ? "QUẢN TRỊ VIÊN (ADMIN)" : "NGƯỜI BẦU CHỌN (VOTER)";
        roleLabel.style.background = isAdmin ? "#e74c3c" : "#2ecc71";
        roleLabel.style.color = "white";
    }

    if (isAdmin) {
        if (adminBtn) adminBtn.style.display = "inline-block";
        if (startBtn) startBtn.style.display = "block";

        try {
            const isStarted = await contract.electionStarted();
            const endTime = await contract.endTime();
            const now = Math.floor(Date.now() / 1000);
            
            if (stopBtn) {
                stopBtn.style.display = (isStarted && Number(endTime) > now) ? "block" : "none";
            }

            // Đồng bộ chế độ Whitelist
            const isPrivateMode = await contract.isPrivate();
            const modeSelect = document.getElementById("electionModeSelect");
            const whitelistMgmt = document.getElementById("whitelistManager");
            if (modeSelect) modeSelect.value = isPrivateMode.toString();
            if (whitelistMgmt) whitelistMgmt.style.display = isPrivateMode ? "block" : "none";

            // Tải danh sách Whitelist
            loadWhitelist();
        } catch (err) { console.error(err); }
    }

    document.getElementById("displayName").innerText = `Xin chào: ${name}`;
    loadCandidates(isAdmin); 
    loadVoteHistory(); 
    runCountdown();
}

// --- LOGIC WHITELIST MỚI (THÊM & XÓA & HIỂN THỊ) ---
async function loadWhitelist() {
    const table = document.getElementById("whitelistTable");
    const countLabel = document.getElementById("whitelistCount");
    if (!table) return;

    try {
        const addresses = await contract.getWhitelist();
        if (countLabel) countLabel.innerText = addresses.length;

        if (addresses.length === 0) {
            table.innerHTML = `<p style="padding: 15px; color: #999; text-align: center; margin: 0;">Danh sách trống</p>`;
            return;
        }

        table.innerHTML = addresses.map((addr, index) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 15px; border-bottom: 1px solid #eee; background: ${index % 2 === 0 ? '#fff' : '#f9f9f9'}">
                <span style="font-family: monospace; font-size: 0.8rem; color: #2c3e50;">
                    ${addr.substring(0, 6)}...${addr.substring(38)}
                </span>
                <button onclick="removeVoterFromWhitelist('${addr}')" style="background: none; border: none; color: #e74c3c; cursor: pointer; padding: 2px 5px;">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `).join('');
    } catch (err) { console.error("Lỗi tải Whitelist:", err); }
}

async function addVoterToWhitelist() {
    const addrInput = document.getElementById("whitelistAddressInput");
    const addr = addrInput.value.trim();
    if (!ethers.isAddress(addr)) return alert("Địa chỉ ví không hợp lệ!");
    
    try {
        const tx = await contract.addToWhitelist(addr);
        alert("Đang thêm vào danh sách...");
        await tx.wait();
        addrInput.value = "";
        loadWhitelist(); // Cập nhật lại danh sách mà không cần reload trang
        alert("Đã thêm thành công!");
    } catch (e) { alert("Lỗi: " + (e.reason || e.message)); }
}

async function removeVoterFromWhitelist(addr) {
    if (!confirm(`Xác nhận xóa ví ${addr} khỏi Whitelist?`)) return;
    try {
        const tx = await contract.removeFromWhitelist(addr);
        alert("Đang thực hiện xóa khỏi Blockchain...");
        await tx.wait();
        loadWhitelist();
        alert("Đã xóa thành công!");
    } catch (e) { alert("Lỗi khi xóa: " + (e.reason || e.message)); }
}

async function changeElectionMode() {
    const mode = document.getElementById("electionModeSelect").value === "true";
    try {
        const tx = await contract.setElectionMode(mode);
        alert("Đang chuyển đổi chế độ truy cập...");
        await tx.wait();
        document.getElementById("whitelistManager").style.display = mode ? "block" : "none";
        alert("Cập nhật chế độ thành công!");
    } catch (e) { alert("Lỗi: " + (e.reason || e.message)); }
}

// --- QUẢN LÝ BẦU CỬ ---
async function runCountdown() {
    if (timerInterval) clearInterval(timerInterval);
    const updateUI = async () => {
        const timerLabel = document.getElementById("timerDisplay");
        if (!timerLabel) return;
        try {
            const isStarted = await contract.electionStarted();
            const endTime = await contract.endTime();
            const now = Math.floor(Date.now() / 1000);
            const timeLeft = Number(endTime) - now;

            if (!isStarted || timeLeft <= 0) {
                timerLabel.innerHTML = isStarted 
                    ? `<i class="fas fa-calendar-check"></i> Đã kết thúc.`
                    : `<i class="fas fa-pause-circle"></i> Đang chờ Admin...`;
                return;
            }
            const min = Math.floor(timeLeft / 60);
            const sec = timeLeft % 60;
            timerLabel.innerHTML = `<i class="fas fa-hourglass-half fa-spin"></i> Còn lại: ${min}ph : ${sec}s`;
        } catch (err) { }
    };
    setInterval(updateUI, 1000);
}

async function loadCandidates(isAdmin) {
    const listDiv = document.getElementById("candidateList");
    const resultsDiv = document.getElementById("resultsChart");
    if (!listDiv || !resultsDiv) return;

    try {
        const count = await contract.candidatesCount();
        const totalCandidates = Number(count);
        let totalVotes = 0;
        const candidatesData = [];

        for (let i = 1; i <= totalCandidates; i++) {
            const c = await contract.getCandidate(i); 
            if (c[4]) { // active
                totalVotes += Number(c[2]);
                candidatesData.push(c);
            }
        }

        listDiv.innerHTML = "";
        resultsDiv.innerHTML = "";
        
        candidatesData.forEach(candidate => {
            const [id, name, votes] = candidate;
            const percentage = totalVotes > 0 ? (Number(votes) / totalVotes * 100) : 0;

            const item = document.createElement("div");
            item.className = "candidate-item";
            item.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding: 10px; border: 1px solid #eee; border-radius: 8px;">
                    <div><strong>${name}</strong> (ID: ${id})</div>
                    <div style="display: flex; gap: 5px;">
                        <button onclick="vote(${id})" style="background:#3498db; color:white; border:none; border-radius:4px; padding: 5px 12px; cursor:pointer;">Bầu</button>
                        ${isAdmin ? `
                            <button onclick="openEditModal(${id}, '${name}')" style="background:#f1c40f; color:white; border:none; border-radius:4px; padding: 5px 8px;"><i class="fas fa-edit"></i></button>
                            <button onclick="deleteCandidate(${id})" style="background:#e74c3c; color:white; border:none; border-radius:4px; padding: 5px 8px;"><i class="fas fa-trash"></i></button>
                        ` : ""}
                    </div>
                </div>`;
            listDiv.appendChild(item);

            const resultRow = document.createElement("div");
            resultRow.innerHTML = `
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                        <span>${name}</span>
                        <span>${votes} phiếu</span>
                    </div>
                    <div style="background: #eee; height: 8px; border-radius: 4px;">
                        <div style="background: #3498db; width: ${percentage}%; height: 100%; border-radius: 4px;"></div>
                    </div>
                </div>`;
            resultsDiv.appendChild(resultRow);
        });
    } catch (err) { console.error(err); }
}

async function vote(id) {
    try {
        const tx = await contract.vote(id);
        alert("Đang gửi phiếu bầu của bạn...");
        await tx.wait();
        alert("Bầu chọn thành công!");
        location.reload();
    } catch (e) { alert("Lỗi: " + (e.reason || "Bạn không được phép bầu!")); }
}

// Gán hàm vào window để HTML gọi được
window.handleAuth = handleAuth;
window.handleStartElection = handleStartElection;
window.handleEndElection = handleEndElection;
window.vote = vote;
window.addNewCandidate = addNewCandidate;
window.deleteCandidate = deleteCandidate;
window.openEditModal = openEditModal;
window.saveCandidateEdit = saveCandidateEdit;
window.changeElectionMode = changeElectionMode;
window.addVoterToWhitelist = addVoterToWhitelist;
window.removeVoterFromWhitelist = removeVoterFromWhitelist;
window.toggleAdminPanel = () => {
    const p = document.getElementById("adminSection");
    p.style.display = p.style.display === "none" ? "block" : "none";
};


init();