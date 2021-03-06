import glob
import os

from setuptools import setup, find_packages
from stat import ST_MODE, S_IEXEC, S_ISDIR
from Cython.Build import cythonize

def executable(path):
    st = os.stat(path)[ST_MODE]
    return (st & S_IEXEC) and not S_ISDIR(st)

dependencies = """
Babel
PIL
argparse
beautifulsoup4
DBUtils
genshi
gunicorn
iptools
lxml
psycopg2
pymarc
pytest
python-memcached
pyyaml
simplejson
supervisor
web.py==0.33
pystatsd
eventer
Pygments
OL-GeoIP
mockcache
"""

setup(
    name='openlibrary',
    version='2.0',
    description='Open Library',
    packages=find_packages(exclude=["ez_setup"]),
    scripts=filter(executable, glob.glob('scripts/*')),
    install_requires=dependencies.split(),
    # Used to make solrbuilder faster
    ext_modules=cythonize("openlibrary/solr/update_work.py")
)

