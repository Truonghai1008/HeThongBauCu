// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DecentralizedVoting {

    // 1. Cấu trúc dữ liệu nâng cấp
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
        string imageCID; // Lưu link ảnh (IPFS Hash)
        bool active;     // Trạng thái: true là hiển thị, false là đã xóa
    }

    // 2. Các biến trạng thái
    address public admin;
    uint256 public candidatesCount;

    mapping(uint256 => Candidate) public candidates;
    mapping(address => bool) public hasVoted;
    mapping(address => string) public voterNames;

    // 3. Sự kiện
    event votedEvent(uint256 indexed _candidateId);
    event candidateAdded(uint256 indexed candidateId, string name, string imageCID);
    event candidateDeleted(uint256 indexed candidateId); // Sự kiện khi xóa
    event voterRegistered(address indexed voterAddress, string name);

    // 4. Quyền truy cập
    modifier onlyAdmin() {
        require(msg.sender == admin, "Chi Admin moi co quyen nay!");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // 5. Các hàm chức năng

    function registerVoter(string memory _name) public {
        require(bytes(_name).length > 0, "Ten khong duoc de trong!");
        voterNames[msg.sender] = _name;
        emit voterRegistered(msg.sender, _name);
    }

    // Hàm thêm ứng cử viên: NHẬN THÊM CID ẢNH
    function addCandidate(string memory _name, string memory _imageCID) public onlyAdmin {
        candidatesCount++;
        // Khởi tạo ứng viên với active = true
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0, _imageCID, true);
        emit candidateAdded(candidatesCount, _name, _imageCID);
    }

    // HÀM XÓA ỨNG VIÊN (Chỉ Admin)
    // Lưu ý: Chúng ta không dùng lệnh 'delete' vì nó sẽ làm xáo trộn ID. 
    // Chúng ta chuyển 'active' về false để Frontend biết mà ẩn đi.
    function deleteCandidate(uint256 _candidateId) public onlyAdmin {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Ung cu vien khong ton tai!");
        candidates[_candidateId].active = false;
        emit candidateDeleted(_candidateId);
    }

    function vote(uint256 _candidateId) public {
        require(!hasVoted[msg.sender], "Ban da bau chon roi!");
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Ung cu vien khong ton tai!");
        require(candidates[_candidateId].active, "Ung cu vien nay da bi go bo!");

        hasVoted[msg.sender] = true;
        candidates[_candidateId].voteCount++;

        emit votedEvent(_candidateId);
    }

    // Cập nhật hàm lấy dữ liệu để trả về thêm Image và Trạng thái active
    function getCandidate(uint256 _candidateId) public view returns (uint256, string memory, uint256, string memory, bool) {
        Candidate memory c = candidates[_candidateId];
        return (c.id, c.name, c.voteCount, c.imageCID, c.active);
    }
}