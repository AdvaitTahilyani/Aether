export default function NoEmailSelected() {
  return (
    <div className="h-full flex items-center justify-center bg-[#121212] text-white">
      <div className="max-w-md w-full px-8 py-12 rounded-xl bg-[#1E1E1E] border border-white/10 shadow-2xl backdrop-blur-sm flex flex-col items-center text-center">
        <div className="relative mb-8">
          <div className="w-24 h-28 mx-auto flex items-center justify-center">
            <img
              src="/icons/mail-icon.svg"
              alt="No email selected"
              width="96"
              height="108"
              loading="eager"
            />
          </div>

          <div className="absolute -top-2 -right-2 bg-[#2A2A2A] p-2 rounded-full border border-white/10">
            <img
              src="/icons/arrow-select.svg"
              alt="Select an email"
              width="24"
              height="24"
              loading="eager"
            />
          </div>
        </div>

        <h3 className="text-2xl font-medium mb-3 bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
          No Email Selected
        </h3>

        <p className="text-gray-400 mb-6 max-w-xs">
          Select an email from the list to view its contents and continue the
          conversation.
        </p>

        <div className="w-full max-w-xs bg-[#2A2A2A] rounded-lg p-4 border border-white/5">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
              <span className="text-blue-400 text-xs">Tip</span>
            </div>
            <span className="text-sm font-medium text-gray-300">
              Quick Navigation
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Use keyboard shortcuts:{" "}
            <kbd className="px-2 py-1 bg-black/30 rounded text-xs mx-1">↑</kbd>{" "}
            and{" "}
            <kbd className="px-2 py-1 bg-black/30 rounded text-xs mx-1">↓</kbd>{" "}
            to navigate between emails.
          </p>
        </div>
      </div>
    </div>
  );
}
