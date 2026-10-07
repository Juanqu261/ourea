import { BRAND } from '../config/brand.js';
import { OureaLogo } from './OureaLogo.jsx';
import { BarButton, HelpIcon, MenuItem, MoreIcon } from './BarButton.jsx';

export function TopBar({
  areaLabel,
  mode,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onHelp,
  onAbout,
  onStartOver,
  onToggleExplore,
  onLoadExample,
  onChangeCity = null,
  caseRole = null,
}) {
  return (
    <header className="topbar">
      <div className="brand-group">
        <OureaLogo compact />
        <div className="topbar-place">
          <span className="topbar-area">{areaLabel}</span>
          {caseRole ? <span className="topbar-case-role">{caseRole}</span> : null}
        </div>
      </div>
      <div className="topbar-actions" data-testid="persistent-nav">
        {onChangeCity ? (
          <BarButton testId="change-city" onClick={onChangeCity}>
            Change city
          </BarButton>
        ) : null}
        <BarButton testId="help-button" icon={<HelpIcon />} onClick={onHelp}>
          Help
        </BarButton>
        <div className="topbar-menu">
          <BarButton
            testId="app-menu"
            icon={<MoreIcon />}
            ariaExpanded={menuOpen}
            ariaHaspopup="menu"
            onClick={onToggleMenu}
          >
            More
          </BarButton>
          {menuOpen && (
            <div className="topbar-menu-list" role="menu">
              <MenuItem testId="load-example" onClick={onLoadExample}>Load completed example</MenuItem>
              <MenuItem testId="start-over" onClick={onStartOver}>Start over</MenuItem>
              {onChangeCity ? (
                <MenuItem testId="change-city-menu" onClick={onChangeCity}>Change city</MenuItem>
              ) : null}
              <MenuItem testId="toggle-explore" onClick={onToggleExplore}>
                {mode === 'explore' ? 'Return to guided decision' : 'Explore freely'}
              </MenuItem>
              <MenuItem testId="about-ourea" onClick={onAbout}>About Ourea</MenuItem>
              <MenuItem onClick={onCloseMenu}>Close</MenuItem>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export { BRAND };
