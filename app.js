let contract;
let signer;
const contractAddress = "0x34E2f7B036B4b674B1249535621da0904cFD2e73"; 

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
        console.error("Không thể đọc dữ liệu từ Contract. Kiểm tra lại địa chỉ và mạng!", e);
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
            alert("Đang gửi giao dịch lên Cronos... Vui lòng đợi xác nhận.");
            await tx.wait();
            registeredName = inputName;
        }
        showDashboard(userAddress, registeredName);
    } catch (error) {
        alert("Lỗi xác thực: " + (error.reason || error.message));
    }
}

async function showDashboard(address, name) {
    document.getElementById("authSection").style.display = "none";
    document.getElementById("mainDashboard").style.display = "block";

    const adminAddr = await contract.admin();
    const nameLabel = document.getElementById("displayName");
    const roleLabel = document.getElementById("displayRole");
    const adminBtn = document.getElementById("adminQuickBtn");

    if (address.toLowerCase() === adminAddr.toLowerCase()) {
        roleLabel.innerText = "ADMIN";
        roleLabel.className = "badge admin-badge";
        if (adminBtn) adminBtn.style.display = "inline-block";
    } else {
        roleLabel.innerText = "CỬ TRI";
        roleLabel.className = "badge voter-badge";
        if (adminBtn) adminBtn.style.display = "none";
    }

    nameLabel.innerText = `Xin chào: ${name}`;
    loadCandidates();
}

async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 100; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.5)); // Giảm nhẹ chất lượng để tiết kiệm Gas trên Cronos
            };
        };
    });
}

async function loadCandidates() {
    const listDiv = document.getElementById("candidateList");
    const resultsDiv = document.getElementById("resultsChart");
    if (!listDiv || !resultsDiv) return;

    listDiv.innerHTML = "<p><i class='fas fa-spinner fa-spin'></i> Đang nạp dữ liệu từ Cronos...</p>";
    
    try {
        const count = await contract.candidatesCount();
        const totalCandidates = Number(count);
        let totalVotes = 0;
        const candidatesData = [];
        const userAddress = (await signer.getAddress()).toLowerCase();
        const adminAddr = (await contract.admin()).toLowerCase();

        for (let i = 1; i <= totalCandidates; i++) {
            const c = await contract.getCandidate(i); 
            if (c[4]) { 
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
                ? `<img src="${imageCID}" style="width:50px; height:50px; border-radius:50%; object-fit:cover; margin-right:15px; border:2px solid #eee;">`
                : `<div style="background:${stringToColor(name)}; width:50px; height:50px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; margin-right:15px; font-weight:bold;">${name.charAt(0)}</div>`;

            const deleteBtn = (userAddress === adminAddr) 
                ? `<button onclick="deleteCandidate(${id})" class="btn-delete" style="background:#e74c3c; color:white; border:none; padding:8px 12px; border-radius:5px; margin-left:5px; cursor:pointer;"><i class="fas fa-trash"></i></button>` 
                : "";

            const item = document.createElement("div");
            item.className = "candidate-item";
            item.innerHTML = `
                <div style="display:flex; align-items:center;">
                    ${avatarHTML}
                    <div><strong>${name}</strong><br><small>ID: #${id}</small></div>
                </div>
                <div>
                    <button onclick="vote(${id})" class="btn-vote" style="background:#3498db; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Vote</button>
                    ${deleteBtn}
                </div>`;
            listDiv.appendChild(item);

            const resultRow = document.createElement("div");
            resultRow.style = "margin-bottom: 20px;";
            resultRow.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-size: 0.9em; margin-bottom:5px;">
                    <span>${name}</span>
                    <span><strong>${votes} Phiếu</strong> (${percentage.toFixed(1)}%)</span>
                </div>
                <div style="background:#eee; height:12px; border-radius:6px; overflow:hidden;">
                    <div style="background:#2ecc71; width:${percentage}%; height:100%; transition: width 0.8s;"></div>
                </div>`;
            resultsDiv.appendChild(resultRow);
        }
    } catch (err) {
        listDiv.innerHTML = "Lỗi: Không thể kết nối với Contract trên Cronos.";
    }
}

async function addNewCandidate() {
    const nameInput = document.getElementById("candidateNameInput");
    const imageInput = document.getElementById("candidateImageInput");
    const name = nameInput.value;
    
    if (!name) return alert("Vui lòng nhập tên ứng viên!");

    try {
        let imageData = ""; 
        if (imageInput.files && imageInput.files[0]) {
            alert("Đang xử lý ảnh...");
            imageData = await compressImage(imageInput.files[0]);
        }

        const tx = await contract.addCandidate(name, imageData);
        alert("Giao dịch đã gửi! Đang đợi xác nhận trên Blockchain...");
        await tx.wait();
        alert("Thêm ứng viên thành công!");
        
        nameInput.value = ""; 
        imageInput.value = "";
        loadCandidates(); 
    } catch (err) {
        alert("Lỗi: " + (err.reason || err.message));
    }
}

async function deleteCandidate(id) {
    if (!confirm("Bạn có chắc muốn xóa ứng viên này?")) return;
    try {
        const tx = await contract.deleteCandidate(id);
        await tx.wait();
        alert("Đã xóa ứng viên!");
        loadCandidates();
    } catch (err) {
        alert("Lỗi: " + (err.reason || err.message));
    }
}

async function vote(id) {
    try {
        const tx = await contract.vote(id);
        alert("Đang xác nhận phiếu bầu...");
        await tx.wait();
        alert("Bầu chọn thành công!");
        loadCandidates();
    } catch (err) {
        alert("Lỗi: " + (err.reason || "Bạn đã bầu rồi hoặc có lỗi xảy ra!"));
    }
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${hash % 360}, 65%, 50%)`;
}

window.handleAuth = handleAuth;
window.addNewCandidate = addNewCandidate;
window.vote = vote;
window.deleteCandidate = deleteCandidate;
window.toggleAdminPanel = function() {
    const panel = document.getElementById("adminSection");
    panel.style.display = (panel.style.display === "none") ? "block" : "none";
};

init();