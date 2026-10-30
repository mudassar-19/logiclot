/**
 * Shared dashboard background with teal→navy→purple gradient + radial glows
 * Used by both /app/* and /demo routes
 */
const DashboardBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" style={{ pointerEvents: 'none' }}>
      {/* Base gradient: teal top-left → deep navy center → purple bottom-right */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #0c2a2a 0%, #0a1628 30%, #0d1f3c 50%, #1a1040 80%, #150a2e 100%)',
        }}
      />

      {/* Teal/green glow — top-left */}
      <div
        className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%]"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.05) 40%, transparent 70%)',
        }}
      />

      {/* Purple/magenta glow — bottom-right */}
      <div
        className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%]"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.12) 0%, rgba(139, 92, 246, 0.04) 40%, transparent 70%)',
        }}
      />

      {/* Subtle center glow for depth */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%]"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(6, 182, 212, 0.04) 0%, transparent 60%)',
        }}
      />

      {/* Pink accent glow — bottom-left */}
      <div
        className="absolute bottom-[10%] left-[5%] w-[30%] h-[30%]"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(236, 72, 153, 0.06) 0%, transparent 70%)',
        }}
      />

      {/* Subtle grid overlay for depth */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0L0 0 0 60' fill='none' stroke='%23888' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
};

export default DashboardBackground;
