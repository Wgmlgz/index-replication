package planner

type FullAlgorithm struct{}

func NewFullAlgorithm() *FullAlgorithm {
	return &FullAlgorithm{}
}

func (a *FullAlgorithm) Key() string {
	return "full"
}

func (a *FullAlgorithm) Plan(input Input) (Output, error) {
	// TODO
}
