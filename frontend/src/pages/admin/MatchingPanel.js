import React, { useState, useEffect } from 'react';

const MatchingPanel = () => {
  const [enquiries, setEnquiries] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);

  // Replace this with your actual Railway URL (e.g., https://rage-production.up.railway.app)
  const API_BASE = "https://your-railway-url.up.railway.app/api";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [enqRes, memRes] = await Promise.all([
          fetch(`${API_BASE}/admin/enquiries`),
          fetch(`${API_BASE}/admin/members`) // Ensure this endpoint exists
        ]);
        const enqData = await enqRes.json();
        const memData = await memRes.json();
        setEnquiries(enqData);
        setMembers(memData);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCreateAllocation = async (memberId) => {
    if (!selectedEnquiry) return alert("Please select an enquiry first!");

    const payout = prompt("Enter Payout to Member (e.g. 5000):");
    const cost = prompt("Enter Cost to Admin (e.g. 7000):");

    if (!payout || !cost) return;

    const allocationData = {
      enquiry_id: selectedEnquiry._id,
      member_id: memberId,
      payout_to_member: parseFloat(payout),
      cost_to_admin: parseFloat(cost),
      admin_workflow: "sent",
      member_response: "pending"
    };

    try {
      const response = await fetch(`${API_BASE}/admin/allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allocationData)
      });

      if (response.ok) {
        alert("Allocation created successfully!");
        // Optionally refresh the list or clear selection
        setSelectedEnquiry(null);
      } else {
        alert("Failed to create allocation.");
      }
    } catch (err) {
      alert("Error connecting to server.");
    }
  };

  if (loading) return <div className="p-10">Loading RAGE Operations...</div>;

  return (
    <div className="flex h-screen bg-white font-sans">
      {/* Left Pane: Enquiries */}
      <div className="w-1/3 border-r border-gray-200 overflow-y-auto p-6">
        <h2 className="text-2xl font-bold mb-6 text-black">Active Enquiries</h2>
        {enquiries.length === 0 ? <p className="text-gray-500">No unassigned enquiries.</p> : 
          enquiries.map((enq) => (
            <div 
              key={enq._id}
              onClick={() => setSelectedEnquiry(enq)}
              className={`p-4 mb-4 rounded-lg cursor-pointer border transition-all ${
                selectedEnquiry?._id === enq._id ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-300'
              }`}
            >
              <p className="font-semibold text-lg">{enq.client?.name || "Anonymous Client"}</p>
              <p className="text-sm text-gray-500 uppercase tracking-widest">{enq.type}</p>
            </div>
          ))
        }
      </div>

      {/* Right Pane: Member Selection */}
      <div className="w-2/3 p-10 bg-gray-50 overflow-y-auto">
        {selectedEnquiry ? (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Matching for {selectedEnquiry.client.name}</h1>
              <p className="text-gray-600">Select a member to allocate this enquiry to.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {members.map((member) => (
                <div key={member._id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">{member.profile?.name || member.email}</h3>
                    <p className="text-sm text-gray-500">{member.role}</p>
                  </div>
                  <button 
                    onClick={() => handleCreateAllocation(member._id)}
                    className="bg-black text-white px-6 py-2 rounded-full font-medium hover:bg-gray-800 transition-colors"
                  >
                    Match
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Select an enquiry from the left to start matching.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchingPanel;
