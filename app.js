let contract;
let signer;
const contractAddress = "0xa5aa7033881c4e54dD70C8f3A9803ec98b9756b0";

async function init() {
    if (window.ethereum) {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            
            const network = await provider.getNetwork();
            if (network.chainId !== 338n) {
                alert("Vui lòng chuyển MetaMask sang mạng Cronos Testnet!");
                return;
            }

            // Tự động làm mới khi đổi ví hoặc mạng
            window.ethereum.on('accountsChanged', () => location.reload());
            window.ethereum.on('chainChanged', () => location.reload());

            const accounts = await provider.listAccounts();
            if (accounts.length > 0) {
                await setupContract();
                const userAddress = await signer.getAddress();
                await updateAuthUI(userAddress);
            }
        } catch (error) {
            console.error("Lỗi khởi tạo:", error);
        }
    } else {
        alert("Vui lòng cài đặt MetaMask!");
    }
}

async function setupContract() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    contract = new ethers.Contract(contractAddress, contractABI, signer);
}

async function updateAuthUI(address) {
    try {
        const registeredName = await contract.voterNames(address);
        if (registeredName && registeredName !== "") {
            showDashboard(address, registeredName);
        }
    } catch (e) {
        console.error("Lỗi kết nối Contract:", e);
    }
}

async function handleAuth() {
    try {
        await setupContract();
        const userAddress = await signer.getAddress();
        let registeredName = await contract.voterNames(userAddress);

        if (!registeredName || registeredName === "") {
            const inputName = document.getElementById("voterNameInput").value;
            if (!inputName) return alert("Vui lòng nhập tên tài khoản!");

            const tx = await contract.registerVoter(inputName);
            alert("Đang xác thực danh tính trên Cronos...");
            await tx.wait();
            registeredName = inputName;
        }
        showDashboard(userAddress, registeredName);
    } catch (error) {
        alert("Lỗi: " + (error.reason || error.message));
    }
}

async function showDashboard(address, name) {
    // 1. Dọn dẹp giao diện cũ
    document.getElementById("authSection").style.display = "none";
    document.getElementById("mainDashboard").style.display = "block";

    // 2. Lấy thông tin từ Contract
    const adminAddr = await contract.admin();
    const nameLabel = document.getElementById("displayName");
    const roleLabel = document.getElementById("displayRole");
    const adminBtn = document.getElementById("adminQuickBtn");
    const adminSection = document.getElementById("adminSection");

    // Mặc định ẩn Panel Admin để bảo mật Frontend
    if (adminBtn) adminBtn.style.display = "none";
    if (adminSection) adminSection.style.display = "none";

    // 3. Kiểm tra quyền Admin (Case-insensitive)
    if (address.toLowerCase() === adminAddr.toLowerCase()) {
        roleLabel.innerText = "QUẢN TRỊ VIÊN (ADMIN)";
        roleLabel.className = "badge admin-badge";
        if (adminBtn) adminBtn.style.display = "inline-block";
    } else {
        roleLabel.innerText = "CỬ TRI HỢP LỆ";
        roleLabel.className = "badge voter-badge";
    }

    nameLabel.innerText = `Xin chào: ${name}`;
    loadCandidates();
}

async function vote(id) {
    // Mô phỏng Ẩn danh: Yêu cầu mã bí mật để Hash
    const secretCode = prompt("Nhập mã bí mật của bạn (để ẩn danh phiếu bầu):");
    if (!secretCode) return alert("Bạn cần nhập mã bí mật để tiếp tục!");

    try {
        const userAddress = await signer.getAddress();
        // Tạo Secret Hash từ địa chỉ ví + mã bí mật
        const secretHash = ethers.keccak256(ethers.toUtf8Bytes(userAddress + secretCode));

        // Lưu ý: Hàm vote trong .sol phải được cập nhật để nhận bytes32 secretHash
        const tx = await contract.vote(id, secretHash); 
        
        alert("Đang xác nhận phiếu bầu ẩn danh...");
        await tx.wait();
        alert("Bầu chọn thành công! Phiếu của bạn đã được mã hóa.");
        loadCandidates();
    } catch (err) {
        alert("Lỗi: " + (err.reason || "Bạn chưa có tên trong danh sách KYC hoặc đã bầu rồi!"));
    }
}

// ... (Các hàm loadCandidates, addNewCandidate, deleteCandidate giữ nguyên logic cũ nhưng thêm toLowerCase khi so sánh) ...

async function loadCandidates() {
    const listDiv = document.getElementById("candidateList");
    const resultsDiv = document.getElementById("resultsChart");
    if (!listDiv || !resultsDiv) return;

    listDiv.innerHTML = "<p>Đang tải dữ liệu...</p>";
    
    try {
        const count = await contract.candidatesCount();
        const totalCandidates = Number(count);
        let totalVotes = 0;
        const candidatesData = [];
        const userAddress = (await signer.getAddress()).toLowerCase();
        const adminAddr = (await contract.admin()).toLowerCase();

        for (let i = 1; i <= totalCandidates; i++) {
            const c = await contract.getCandidate(i); 
            if (c[4]) { // Kiểm tra trạng thái tồn tại
                totalVotes += Number(c[2]);
                candidatesData.push(c);
            }
        }

        listDiv.innerHTML = "";
        resultsDiv.innerHTML = "";
        
        for (let candidate of candidatesData) {
            const [id, name, votes, imageCID] = candidate;
            const percentage = totalVotes > 0 ? (Number(votes) / totalVotes * 100) : 0;
            
            const isBase64 = imageCID && imageCID.startsWith("data:image");
            const avatarHTML = isBase64 
                ? `<img src="${imageCID}" class="avatar">`
                : `<div class="avatar-placeholder" style="background:${stringToColor(name)}">${name.charAt(0)}</div>`;

            // Nút xóa chỉ hiện cho Admin
            const deleteBtn = (userAddress === adminAddr) 
                ? `<button onclick="deleteCandidate(${id})" class="btn-delete"><i class="fas fa-trash"></i></button>` 
                : "";

            const item = document.createElement("div");
            item.className = "candidate-item";
            item.innerHTML = `
                <div class="candidate-info">
                    ${avatarHTML}
                    <div><strong>${name}</strong><br><small>Mã số: #${id}</small></div>
                </div>
                <div class="actions">
                    <button onclick="vote(${id})" class="btn-vote">Bầu chọn</button>
                    ${deleteBtn}
                </div>`;
            listDiv.appendChild(item);

            // Cập nhật biểu đồ kết quả
            const resultRow = document.createElement("div");
            resultRow.className = "result-row";
            resultRow.innerHTML = `
                <div class="result-label">
                    <span>${name}</span>
                    <span><strong>${votes}</strong> (${percentage.toFixed(1)}%)</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${percentage}%"></div>
                </div>`;
            resultsDiv.appendChild(resultRow);
        }
    } catch (err) {
        listDiv.innerHTML = "Lỗi kết nối dữ liệu mạng Cronos.";
    }
}

// Khai báo các hàm toàn cục
window.handleAuth = handleAuth;
window.addNewCandidate = addNewCandidate;
window.vote = vote;
window.deleteCandidate = deleteCandidate;
window.toggleAdminPanel = function() {
    const panel = document.getElementById("adminSection");
    panel.style.display = (panel.style.display === "none") ? "block" : "none";
};

init();