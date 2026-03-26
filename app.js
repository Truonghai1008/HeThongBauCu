let contract;
let signer;
const contractAddress = "0x0EF25B6BC8E0926d739E5e955F52A388464129bf";

async function init() {
    if (window.ethereum) {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const network = await provider.getNetwork();
            if (network.chainId !== 338n) {
                alert("Vui lòng chuyển MetaMask sang mạng Cronos Testnet!");
                return;
            }

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
            alert("Đang xác thực danh tính trên Blockchain...");
            await tx.wait();
            registeredName = inputName;
        }
        showDashboard(userAddress, registeredName);
    } catch (error) {
        alert("Lỗi: " + (error.reason || error.message));
    }
}

async function showDashboard(address, name) {
    document.getElementById("authSection").style.display = "none";
    document.getElementById("mainDashboard").style.display = "block";

    const adminAddr = await contract.admin();
    const nameLabel = document.getElementById("displayName");
    const roleLabel = document.getElementById("displayRole");
    const adminBtn = document.getElementById("adminQuickBtn");
    const adminSection = document.getElementById("adminSection");

    // Ép ẩn các thành phần Admin trước khi kiểm tra
    if (adminBtn) adminBtn.style.display = "none";
    if (adminSection) adminSection.style.display = "none";

    if (address.toLowerCase() === adminAddr.toLowerCase()) {
        roleLabel.innerText = "QUẢN TRỊ VIÊN (ADMIN)";
        roleLabel.className = "badge admin-badge";
        if (adminBtn) adminBtn.style.display = "inline-block";
    } else {
        roleLabel.innerText = "CỬ TRI";
        roleLabel.className = "badge voter-badge";
    }

    nameLabel.innerText = `Xin chào: ${name}`;
    loadCandidates();
}

async function vote(id) {
    try {
        // Kiểm tra thời gian kết thúc ở Frontend trước
        const endTime = await contract.endTime();
        const now = Math.floor(Date.now() / 1000);
        
        if (now > Number(endTime)) {
            return alert("Rất tiếc, cuộc bầu cử đã kết thúc!");
        }

        const tx = await contract.vote(id); 
        alert("Đang gửi phiếu bầu của bạn...");
        await tx.wait();
        alert("Bầu chọn thành công!");
        loadCandidates();
    } catch (err) {
        alert("Lỗi: " + (err.reason || "Cuộc bầu cử chưa bắt đầu hoặc bạn đã bầu rồi!"));
    }
}

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
            if (c[4]) { // c[4] là biến active
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
                : `<div class="avatar-placeholder" style="background:#3498db; color:white; width:50px; height:50px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">${name.charAt(0)}</div>`;

            const deleteBtn = (userAddress === adminAddr) 
                ? `<button onclick="deleteCandidate(${id})" class="btn-delete" style="color:red; background:none; border:none; cursor:pointer; margin-left:10px;"><i class="fas fa-trash"></i></button>` 
                : "";

            const item = document.createElement("div");
            item.className = "candidate-item";
            item.style = "display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding: 10px; border: 1px solid #eee; border-radius: 8px;";
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    ${avatarHTML}
                    <div><strong>${name}</strong><br><small>ID: #${id}</small></div>
                </div>
                <div>
                    <button onclick="vote(${id})" class="btn-vote" style="padding: 5px 15px; cursor: pointer;">Bầu chọn</button>
                    ${deleteBtn}
                </div>`;
            listDiv.appendChild(item);

            const resultRow = document.createElement("div");
            resultRow.className = "result-row";
            resultRow.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                    <span>${name}</span>
                    <span><strong>${votes}</strong> phiếu (${percentage.toFixed(1)}%)</span>
                </div>
                <div style="background: #eee; height: 10px; border-radius: 5px; margin-top: 5px;">
                    <div style="background: #3498db; width: ${percentage}%; height: 100%; border-radius: 5px;"></div>
                </div>`;
            resultsDiv.appendChild(resultRow);
        }
    } catch (err) {
        listDiv.innerHTML = "Lỗi kết nối dữ liệu Blockchain.";
    }
}

async function addNewCandidate() {
    const name = document.getElementById("candidateNameInput").value;
    const fileInput = document.getElementById("candidateImageInput");
    
    if (!name) return alert("Vui lòng nhập tên!");
    
    let imageCID = "";
    if (fileInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            imageCID = e.target.result;
            await sendCandidateTx(name, imageCID);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        await sendCandidateTx(name, "");
    }
}

async function sendCandidateTx(name, cid) {
    try {
        const tx = await contract.addCandidate(name, cid);
        alert("Đang thêm ứng viên...");
        await tx.wait();
        alert("Thành công!");
        location.reload();
    } catch (e) {
        alert("Lỗi: " + e.message);
    }
}

async function deleteCandidate(id) {
    if (!confirm("Bạn có chắc chắn muốn xóa ứng viên này?")) return;
    try {
        const tx = await contract.deleteCandidate(id);
        await tx.wait();
        alert("Đã xóa ứng viên!");
        loadCandidates();
    } catch (e) {
        alert("Lỗi xóa: " + e.message);
    }
}

// Global functions
window.handleAuth = handleAuth;
window.vote = vote;
window.deleteCandidate = deleteCandidate;
window.addNewCandidate = addNewCandidate;
window.toggleAdminPanel = function() {
    const panel = document.getElementById("adminSection");
    panel.style.display = (panel.style.display === "none") ? "block" : "none";
};

init();