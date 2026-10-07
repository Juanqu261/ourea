import { ClimateContextPanel } from '../components/ClimateContextPanel.jsx';
import { ScenarioControls } from '../components/ScenarioControls.jsx';
import { PortfolioBuilder } from '../components/PortfolioBuilder.jsx';
import { DecisionAnalysis } from '../components/DecisionAnalysis.jsx';
import { EvidencePanel } from '../components/EvidencePanel.jsx';
import { CommunitySafeguardsPanel } from '../components/CommunitySafeguardsPanel.jsx';
import { PlanAlignmentPanel } from '../components/PlanAlignmentPanel.jsx';

const TABS = [
  { id: 'scenario', label: 'Scenario' },
  { id: 'build', label: 'Build' },
  { id: 'compare', label: 'Compare' },
  { id: 'evidence', label: 'Evidence' },
];

export function ExploreWorkspace({
  state,
  onTab,
  data,
  workspace,
  selectedType,
  onSelectType,
  selectedCell,
  selectedCellId,
  onSelectCell,
  onExport,
  onInvalidate,
}) {
  return (
    <div className="explore-workspace" data-testid="explore-workspace">
      <div className="explore-tabs" role="tablist" aria-label="Explore freely">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={state.exploreTab === tab.id}
            className={state.exploreTab === tab.id ? 'active' : ''}
            data-testid={`explore-tab-${tab.id}`}
            onClick={() => onTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="explore-body" role="tabpanel">
        {state.exploreTab === 'scenario' && (
          <>
            <ClimateContextPanel
              climate={data?.climateContext}
              scenario={workspace.scenario}
              onSelectPreset={(preset) => {
                workspace.applyClimatePreset(preset);
                onInvalidate?.();
              }}
            />
            <ScenarioControls
              scenario={workspace.scenario}
              onScenarioChange={(next) => {
                workspace.setScenario(next);
                onInvalidate?.();
              }}
              climate={data?.climateContext}
              summary={data?.summary}
              metrics={workspace.metrics}
            />
          </>
        )}
        {state.exploreTab === 'build' && (
          <PortfolioBuilder
            budgetCredits={workspace.budgetCredits}
            onBudgetChange={(value) => {
              workspace.setBudgetCredits(value);
              onInvalidate?.();
            }}
            selectedType={selectedType}
            onSelectType={onSelectType}
            selectedCell={selectedCell}
            cells={data?.cells}
            selectedCellId={selectedCellId}
            onSelectCell={onSelectCell}
            userPlan={workspace.userPlan}
            userCost={workspace.userCost}
            canAddSelected={workspace.canAddSelected}
            onAddSelected={workspace.addSelectedIntervention}
            onRemoveUserProject={workspace.removeUserProject}
            onClearUser={workspace.clearUserPlan}
            aiPlan={workspace.aiPlan}
            aiDiagnostics={workspace.aiDiagnostics}
            alternatives={workspace.alternatives}
            alternativeBusy={workspace.alternativeBusy}
            alternativeError={workspace.alternativeError}
            selectedAiProfileId={workspace.selectedAiProfileId}
            onGenerateAlternatives={() => workspace.generateAlternatives(state.profileId)}
            onSelectAlternative={workspace.selectAlternative}
            stability={workspace.stability}
          />
        )}
        {state.exploreTab === 'compare' && (
          <DecisionAnalysis
            baseline={workspace.baseline}
            metrics={workspace.metrics}
            monteCarlo={workspace.monteCarlo}
            capturedVolumeM3={workspace.capturedVolumeM3}
            frontier={workspace.frontier}
            frontierBusy={workspace.frontierBusy}
            frontierError={workspace.frontierError}
            budgetCredits={workspace.budgetCredits}
            onAnalyzeFrontier={workspace.analyzeFrontier}
            onExport={onExport}
            canExport={Boolean(workspace.metrics)}
            stability={workspace.stability}
            stabilityBusy={workspace.stabilityBusy}
            stabilityError={workspace.stabilityError}
            onAnalyzeStability={workspace.analyzeStability}
            pareto={workspace.pareto}
            paretoBusy={workspace.paretoBusy}
            paretoError={workspace.paretoError}
            onAnalyzePareto={workspace.analyzePareto}
            activePolicyLabel={workspace.aiDiagnostics?.profile?.label}
            benchmark={workspace.benchmark}
            breakage={workspace.breakage}
            benchmarkBusy={workspace.benchmarkBusy}
            benchmarkError={workspace.benchmarkError}
            onAnalyzeBenchmark={workspace.analyzeBenchmark}
            cells={data?.cells}
            activePlan={workspace.activePlan}
            rainMm={workspace.scenario.rainMm}
          />
        )}
        {state.exploreTab === 'evidence' && (
          <>
            <EvidencePanel
              evidence={data?.evidence}
              retrospective={data?.retrospective}
              caseConfig={data?.caseConfig}
            />
            <CommunitySafeguardsPanel
              assessment={workspace.communityAssessment}
              activePlan={workspace.activePlan}
              onRecord={workspace.upsertSessionCommunityRecord}
            />
            <PlanAlignmentPanel alignment={data?.planAlignment} />
          </>
        )}
      </div>
    </div>
  );
}
