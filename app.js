let contract;
let signer;
let timerInterval;
const contractAddress = "0xe2FE81944F0a77EC741B46b448f1E7312a88319D"; 

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
    timerInterval = setInterval(async () => {
        const timerLabel = document.getElementById("timerDisplay");
        if (!timerLabel) return;

        const isStarted = await contract.electionStarted();
        if (!isStarted) {
            timerLabel.innerText = "Trạng thái: Đang chờ Admin bắt đầu...";
            return;
        }

        const endTime = await contract.endTime();
        const now = Math.floor(Date.now() / 1000);
        const timeLeft = Number(endTime) - now;

        if (timeLeft > 0) {
            timerLabel.innerText = `Thời gian còn lại: ${Math.floor(timeLeft/60)}p ${timeLeft%60}s`;
            timerLabel.style.color = "#2ecc71";
        } else {
            timerLabel.innerText = "Cuộc bầu cử đã kết thúc!";
            timerLabel.style.color = "red";
            clearInterval(timerInterval);
        }
    }, 1000);
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