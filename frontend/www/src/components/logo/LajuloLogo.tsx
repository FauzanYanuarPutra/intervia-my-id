import React from 'react';

const LajukanLogo = () => {
  return (
    <div className=" font-poppins group cursor-pointer select-none">
      <div className="flex items-baseline gap-0">
        {/* "Laju" - Bold & Solid */}
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] transition-colors duration-300 group-hover:text-[color:var(--app-text)]">
          Laju
        </h1>

        {/* "lo" dengan Ikon Terintegrasi */}
        <div className="relative flex items-center">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-[color:var(--app-accent)] transition-transform duration-500 group-hover:scale-105">
            Kan
          </h1>

          {/* Aksesoris Ikon Melingkar di atas huruf 'l' */}
          <div className="absolute -top-1 -right-3 md:-top-2 md:-right-3 opacity-80 group-hover:opacity-100 transition-opacity">
            <svg
              className="w-4 h-4 md:w-5 md:h-5 text-[color:var(--app-accent)] animate-[spin_8s_linear_infinite]"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2V5M12 19V22M4.93 4.93L7.05 7.05M16.95 16.95L19.07 19.07M2 12H5M19 12H22M4.93 19.07L7.05 16.95M16.95 7.05L19.07 4.93"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="3" className="fill-current" />
            </svg>
          </div>
        </div>

        {/* Dot Com - Discreet but clean */}
        <span className="text-[8px] md:text-md font-semibold text-[color:var(--app-text-soft)] ml-1 transition-colors group-hover:text-[color:var(--app-accent)]">
          .com
        </span>
      </div>
    </div>
  );
};

export default LajukanLogo;