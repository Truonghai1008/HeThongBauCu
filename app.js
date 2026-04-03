let contract;
let signer;
let timerInterval;
const contractAddress = "0x0706C505c435b0eac09e5c121E228F2E0100AA6a"; 

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
        // Kiểm tra nếu tên tồn tại và không phải chuỗi rỗng
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
        alert("Đang gửi yêu cầu đăng ký lên Blockchain... Vui lòng xác nhận trên MetaMask.");
        await tx.wait(); // Chờ xác nhận block
        alert("Đăng ký thành công!");
        location.reload(); // Tải lại để updateAuthUI nhận diện được tên mới
    } catch (e) { alert("Lỗi đăng ký: " + (e.reason || e.message)); }
}

async function showDashboard(address, name) {
    const authSec = document.getElementById("authSection");
    const dashSec = document.getElementById("mainDashboard");
    if(authSec) authSec.style.display = "none";
    if(dashSec) dashSec.style.display = "block";

    const adminAddr = await contract.admin();
    const isAdmin = address.toLowerCase() === adminAddr.toLowerCase();

    // Hiển thị vai trò
    const roleLabel = document.getElementById("userRole");
    if (roleLabel) {
        roleLabel.innerText = isAdmin ? "QUẢN TRỊ VIÊN (ADMIN)" : "NGƯỜI BẦU CHỌN (VOTER)";
        roleLabel.style.background = isAdmin ? "#e74c3c" : "#2ecc71";
        roleLabel.style.color = "white";
    }

    // Giao diện Admin
    if (isAdmin) {
        const adminBtn = document.getElementById("adminQuickBtn");
        const startBtn = document.getElementById("startElectionBtn");
        if (adminBtn) adminBtn.style.display = "inline-block";
        if (startBtn) startBtn.style.display = "block";
        
        loadWhitelist();
    }

    document.getElementById("displayName").innerText = `Xin chào: ${name}`;
    loadCandidates(isAdmin); 
    loadVoteHistory(); 
    runCountdown();
}

// --- QUẢN LÝ ỨNG CỬ VIÊN (CÁC HÀM BẠN ĐANG THIẾU) ---
async function addNewCandidate() {
    const nameInput = document.getElementById("candidateNameInput");
    if (!nameInput || !nameInput.value) return alert("Nhập tên ứng viên!");
    try {
        const tx = await contract.addCandidate(nameInput.value, "");
        await tx.wait();
        alert("Thêm ứng viên thành công!");
        location.reload();
    } catch (e) { alert("Lỗi: " + (e.reason || e.message)); }
}

async function deleteCandidate(id) {
    if (!confirm("Xác nhận xóa ứng viên này?")) return;
    try {
        const tx = await contract.deleteCandidate(id);
        await tx.wait();
        location.reload();
    } catch (e) { alert("Lỗi: " + (e.reason || e.message)); }
}

function openEditModal(id, currentName) {
    document.getElementById("editCandidateId").value = id;
    document.getElementById("editCandidateName").value = currentName;
    document.getElementById("editCandidateSection").style.display = "block";
}

async function saveCandidateEdit() {
    const id = document.getElementById("editCandidateId").value;
    const newName = document.getElementById("editCandidateName").value;
    try {
        const tx = await contract.updateCandidate(id, newName, "");
        await tx.wait();
        alert("Cập nhật thành công!");
        location.reload();
    } catch (e) { alert("Lỗi: " + (e.reason || e.message)); }
}

// --- CÁC HÀM KHÁC ---
async function loadWhitelist() {
    const table = document.getElementById("whitelistTable");
    try {
        const addresses = await contract.getWhitelist();
        if (!table) return;
        table.innerHTML = addresses.map(addr => `
            <div style="display: flex; justify-content: space-between; padding: 5px 10px; border-bottom: 1px solid #eee;">
                <span>${addr.substring(0,10)}...</span>
                <button onclick="removeVoterFromWhitelist('${addr}')" style="color:red; border:none; background:none; cursor:pointer;"><i class="fas fa-trash"></i></button>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

async function handleStartElection() {
    const min = prompt("Nhập số phút bầu cử:", "10");
    if (!min) return;
    try {
        const tx = await contract.startElection(min);
        await tx.wait();
        location.reload();
    } catch (e) { alert("Lỗi: " + (e.reason || e.message)); }
}

async function vote(id) {
    try {
        const tx = await contract.vote(id);
        alert("Đang gửi phiếu bầu...");
        await tx.wait();
        alert("Bầu chọn thành công!");
        location.reload();
    } catch (e) { alert("Lỗi: " + (e.reason || "Bạn không có quyền bầu!")); }
}


window.handleAuth = handleAuth;
window.handleStartElection = handleStartElection;
window.vote = vote;
window.addNewCandidate = addNewCandidate;
window.deleteCandidate = deleteCandidate;
window.openEditModal = openEditModal;
window.saveCandidateEdit = saveCandidateEdit;
window.toggleAdminPanel = () => {
    const p = document.getElementById("adminSection");
    p.style.display = p.style.display === "none" ? "block" : "none";
};

init();