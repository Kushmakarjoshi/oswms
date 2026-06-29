function formatList(items, fallback = 'None recorded') {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  return items.map((item) => item?.full_name || item?.name || item?.subject || item?.username || item?.game_name || String(item)).join(', ');
}

function buildAdminReport(payload = {}) {
  const summary = payload.summary || {};
  const games = Array.isArray(payload.games) ? payload.games : [];
  const committeeMembers = Array.isArray(payload.committeeMembers) ? payload.committeeMembers : [];
  const teams = Array.isArray(payload.teams) ? payload.teams : [];
  const complaints = Array.isArray(payload.complaints) ? payload.complaints : [];

  const sections = [
    {
      title: 'Executive Summary',
      content: `The administration report covers ${summary.games ?? games.length} game(s), ${summary.teams ?? teams.length} team(s), ${summary.committee_members ?? committeeMembers.length} committee member assignment(s), and ${summary.complaints ?? complaints.length} complaint(s).`
    },
    {
      title: 'Games and Rules',
      content: games.map((game) => `• ${game.name || 'Untitled game'} — ${game.sport_type || 'General'} | Status: ${game.status || 'unknown'} | Rules: ${game.rules_regulations || 'No formal rules provided.'}`).join('\n')
    },
    {
      title: 'Committee Assignments',
      content: committeeMembers.length
        ? committeeMembers.map((member) => `• ${member.full_name || member.username || 'Unnamed'} — ${member.game_name || 'Unassigned game'}`).join('\n')
        : 'No committee assignments recorded.'
    },
    {
      title: 'Team and Captain Overview',
      content: teams.length
        ? teams.map((team) => `• ${team.name || 'Unnamed team'} | Captain: ${team.captain_name || 'Unassigned'} | Members: ${team.member_count ?? 0} | Game: ${team.game_name || 'Unassigned'}`).join('\n')
        : 'No teams registered.'
    },
    {
      title: 'Complaints and Follow-up',
      content: complaints.length
        ? complaints.map((complaint) => `• ${complaint.complaint_code || 'CMP'} | ${complaint.subject || 'Untitled'} | Status: ${complaint.status || 'pending'}`).join('\n')
        : 'No complaints recorded.'
    }
  ];

  return {
    summary,
    sections,
    generatedAt: new Date().toISOString(),
    formattedOverview: sections.map((section) => `${section.title}\n${section.content}`).join('\n\n')
  };
}

module.exports = {
  buildAdminReport,
  formatList
};
