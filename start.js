const fs = require('fs')
const path = require('path')

const {globSync} = require('glob')

const root = path.resolve('C:\\AdsAppsCampaignUI\\private')

const packageMap = {}

function getPackageinfos() {
  const packagefiles = globSync('C:/AdsAppsCampaignUI/private/*/packages/*/package.json')
  
  const packageInfos = packagefiles.map(packagefile => {
    const parent = path.dirname(path.dirname(path.dirname(packagefile)))
    return {
      parent: path.join(parent, 'package.json'),
      packagefile
    }
  })

  // init
  packageInfos.forEach(packageInfo => {
    const packageContent = require(packageInfo.packagefile)

    packageMap[packageContent.name] = {
      incomes: new Set(),
      outcomes: new Set()
    }
  })

  packageInfos.forEach(packageInfo => {
    const packageContent = require(packageInfo.packagefile)

    if (packageContent.peerDependencies) {
      
      Object.keys(packageContent.peerDependencies).map(dep => {
        if (packageMap[dep]) {
          packageMap[dep].outcomes.add(packageContent.name)
        }
        packageMap[packageContent.name].incomes.add(dep);
      })
    }
  })
}

function requiredTests(tests, package) {
  // const tests = new Set();

  packageMap[package].outcomes.forEach(dep => {
    if (!tests.has(dep)) {
      tests.add(dep);
      requiredTests(tests, dep);
    }
  })
  
}

getPackageinfos();

const alltests = new Set();
requiredTests(alltests, '@bingads-webui-campaign-react/campaign-adgroup-creation');

console.log(alltests)