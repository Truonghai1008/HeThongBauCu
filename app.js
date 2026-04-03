let contract;
let signer;
let timerInterval;
const contractAddress = "0x72f867Ec0d8F7a6bF5e978F1Fef86F1B7d928230"; 
const THEME_KEY = "bauCuTheme";

// --- QUẢN LÝ THEME ---
function applyTheme(theme) {
    const root = document.documentElement;
    const themeName = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", themeName);
    localStorage.setItem(THEME_KEY, themeName);
    const btn = document.getElementById("themeToggle");
    if (btn) btn.innerHTML = themeName === "dark" ? '<i class="fas fa-sun"></i> Chế độ sáng' : '<i class="fas fa-moon"></i> Chế độ tối';
}

// --- KHỞI TẠO ---
async function init() {
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
            signer = await provider.getSigner();
            contract = new ethers.Contract(contractAddress, contractABI, signer);
            const userAddr = await signer.getAddress();
            const regName = await contract.voterNames(userAddr);
            if (regName) showDashboard(userAddr, regName);
        }
    }
}

async function handleAuth() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    contract = new ethers.Contract(contractAddress, contractABI, signer);
    const name = document.getElementById("voterNameInput").value.trim();
    if (!name) return alert("Vui lòng nhập tên!");
    try {
        const tx = await contract.registerVoter(name);
        await tx.wait();
        location.reload();
    } catch (e) { alert("Lỗi: " + (e.reason || e.message)); }
}

async function showDashboard(address, name) {
    document.getElementById("authSection").style.display = "none";
    document.getElementById("mainDashboard").style.display = "block";
    document.getElementById("displayName").innerText = `Xin chào: ${name}`;

    const adminAddr = await contract.admin();
    const isAdmin = address.toLowerCase() === adminAddr.toLowerCase();
    
    const roleLabel = document.getElementById("userRole");
    roleLabel.innerText = isAdmin ? "Admin" : "Voter";
    roleLabel.style.background = isAdmin ? "#e74c3c" : "#2ecc71";
    roleLabel.style.color = "#fff";

    if (isAdmin) {
        document.getElementById("adminQuickBtn").style.display = "block";
        const isPrivate = await contract.isPrivate();
        document.getElementById("electionModeSelect").value = isPrivate.toString();
        if (isPrivate) loadWhitelist();
    }

    loadCandidates(isAdmin);
    loadVoteHistory();
    runCountdown();
}

async function loadCandidates(isAdmin) {
    const list = document.getElementById("candidateList");
    const chart = document.getElementById("resultsChart");
    const count = await contract.candidatesCount();
    list.innerHTML = ""; chart.innerHTML = "";
    
    let totalVotes = 0;
    let activeCandidates = [];

    for (let i = 1; i <= Number(count); i++) {
        const c = await contract.getCandidate(i);
        if (c[4]) { 
            activeCandidates.push(c);
            totalVotes += Number(c[2]);
        }
    }

    activeCandidates.forEach(c => {
        const votes = Number(c[2]);
        const percent = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
        
        list.innerHTML += `
            <div class="candidate-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                <span><strong>${c[1]}</strong> (ID: ${c[0]})</span>
                <div>
                    <button onclick="vote(${c[0]})" class="btn-main" style="padding:5px 10px;">Bầu</button>
                    ${isAdmin ? `<button onclick="openEditModal(${c[0]},'${c[1]}')" style="color:blue; border:none; background:none; cursor:pointer;"><i class="fas fa-edit"></i></button>` : ""}
                    ${isAdmin ? `<button onclick="deleteCandidate(${c[0]})" style="color:red; border:none; background:none; cursor:pointer;"><i class="fas fa-trash"></i></button>` : ""}
                </div>
            </div>`;

        chart.innerHTML += `
            <div style="margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; font-size:0.8rem;"><span>${c[1]}</span><span>${votes} phiếu</span></div>
                <div style="background:#eee; height:10px; border-radius:5px;"><div style="background:#3498db; width:${percent}%; height:100%; border-radius:5px;"></div></div>
            </div>`;
    });
}

async function vote(id) {
    try {
        const tx = await contract.vote(id);
        await tx.wait();
        alert("Thành công!");
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi bầu chọn!"); }
}

async function runCountdown() {
    if (timerInterval) clearInterval(timerInterval);
    const update = async () => {
        const label = document.getElementById("timerDisplay");
        const startBtn = document.getElementById("startElectionBtn");
        const stopBtn = document.getElementById("stopElectionBtn");
        try {
            const started = await contract.electionStarted();
            const end = await contract.endTime();
            const now = Math.floor(Date.now() / 1000);
            const remain = Number(end) - now;

            if (!started || remain <= 0) {
                label.innerText = "Trạng thái: Đã kết thúc hoặc chưa bắt đầu";
                if(startBtn) startBtn.style.display = "block";
                if(stopBtn) stopBtn.style.display = "none";
            } else {
                label.innerText = `Còn lại: ${Math.floor(remain/60)}p ${remain%60}s`;
                if(startBtn) startBtn.style.display = "none";
                if(stopBtn) stopBtn.style.display = "block";
            }
        } catch(e) {}
    };
    update();
    timerInterval = setInterval(update, 1000);
}

// Các hàm Admin chuyển ra global để HTML gọi được
window.handleStartElection = async () => {
    const min = prompt("Số phút diễn ra:", "10");
    if(min) {
        try {
            const tx = await contract.startElection(min);
            await tx.wait();
            location.reload();
        } catch(e) { alert(e.reason); }
    }
};

window.handleEndElection = async () => {
    if(confirm("Dừng ngay lập tức?")) {
        const tx = await contract.endElection();
        await tx.wait();
        location.reload();
    }
};

window.addVoterToWhitelist = async () => {
    const addr = document.getElementById("whitelistAddressInput").value.trim();
    if(!ethers.isAddress(addr)) return alert("Địa chỉ ví sai!");
    const tx = await contract.addToWhitelist(addr);
    await tx.wait();
    loadWhitelist();
};

async function loadWhitelist() {
    const list = await contract.getWhitelist();
    const table = document.getElementById("whitelistTable");
    document.getElementById("whitelistCount").innerText = list.length;
    table.innerHTML = list.map(addr => `<div style="font-size:0.7rem; padding:5px; border-bottom:1px solid #eee;">${addr}</div>`).join('');
}

window.toggleAdminPanel = () => {
    const div = document.getElementById("adminSection");
    div.style.display = div.style.display === "none" ? "block" : "none";
};

window.addNewCandidate = async () => {
    const name = document.getElementById("candidateNameInput").value;
    const tx = await contract.addCandidate(name, "");
    await tx.wait();
    location.reload();
};

window.deleteCandidate = async (id) => {
    if(confirm("Xóa ứng viên này?")) {
        const tx = await contract.deleteCandidate(id);
        await tx.wait();
        location.reload();
    }
};

window.openEditModal = (id, name) => {
    document.getElementById("editCandidateId").value = id;
    document.getElementById("editCandidateName").value = name;
    document.getElementById("editCandidateSection").style.display = "block";
};

window.saveCandidateEdit = async () => {
    const id = document.getElementById("editCandidateId").value;
    const name = document.getElementById("editCandidateName").value;
    const tx = await contract.updateCandidate(id, name, "");
    await tx.wait();
    location.reload();
};

init();